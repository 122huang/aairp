import type { DatabaseClient } from '../persistence/clients.js';
import type {
  CreatePromptPackInput,
  CreatePromptTemplateInput,
  CreatePromptVersionInput,
  IPromptRepository,
  PaginatedResult,
  PaginationParams,
  PromptContentExport,
  PromptPack,
  PromptTemplate,
  PromptVersion,
  UpdatePromptVersionInput,
} from '@aairp/shared-kernel';
import { toPromptContentMetadata } from '@aairp/shared-kernel';
import { normalizePagination, parseJson, toIso } from './pg-utils.js';

export class PgPromptRepository implements IPromptRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listPacks(params: PaginationParams): Promise<PaginatedResult<PromptPack>> {
    const { limit, offset } = normalizePagination(params);
    const count = await this.db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM app.prompt_pack',
    );
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.prompt_pack ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return {
      items: rows.rows.map((row) => this.mapPack(row)),
      total: Number(count.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async createPack(input: CreatePromptPackInput): Promise<PromptPack> {
    const rows = await this.db.query<Record<string, unknown>>(
      `INSERT INTO app.prompt_pack (pack_key, name, description) VALUES ($1,$2,$3) RETURNING *`,
      [input.packKey, input.name, input.description ?? null],
    );
    return this.mapPack(rows.rows[0]!);
  }

  async getPackById(promptPackId: string): Promise<PromptPack | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.prompt_pack WHERE prompt_pack_id = $1`,
      [promptPackId],
    );
    return rows.rows[0] ? this.mapPack(rows.rows[0]) : null;
  }

  async getPackByKey(packKey: string): Promise<PromptPack | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.prompt_pack WHERE pack_key = $1`,
      [packKey],
    );
    return rows.rows[0] ? this.mapPack(rows.rows[0]) : null;
  }

  async listTemplates(
    promptPackId: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<PromptTemplate>> {
    const { limit, offset } = normalizePagination(params);
    const count = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app.prompt_template WHERE prompt_pack_id = $1`,
      [promptPackId],
    );
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.prompt_template WHERE prompt_pack_id = $1 ORDER BY template_key LIMIT $2 OFFSET $3`,
      [promptPackId, limit, offset],
    );
    return {
      items: rows.rows.map((row) => this.mapTemplate(row)),
      total: Number(count.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async createTemplate(input: CreatePromptTemplateInput): Promise<PromptTemplate> {
    const rows = await this.db.query<Record<string, unknown>>(
      `INSERT INTO app.prompt_template (prompt_pack_id, template_key, template_type)
       VALUES ($1,$2,$3) RETURNING *`,
      [input.promptPackId, input.templateKey, input.templateType ?? 'open_risk'],
    );
    return this.mapTemplate(rows.rows[0]!);
  }

  async getTemplateById(templateId: string): Promise<PromptTemplate | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.prompt_template WHERE template_id = $1`,
      [templateId],
    );
    return rows.rows[0] ? this.mapTemplate(rows.rows[0]) : null;
  }

  async getTemplateByPackAndKey(
    promptPackId: string,
    templateKey: string,
  ): Promise<PromptTemplate | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.prompt_template WHERE prompt_pack_id = $1 AND template_key = $2`,
      [promptPackId, templateKey],
    );
    return rows.rows[0] ? this.mapTemplate(rows.rows[0]) : null;
  }

  async listVersions(templateId: string): Promise<PromptVersion[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.prompt_version WHERE template_id = $1 ORDER BY version_number DESC`,
      [templateId],
    );
    return rows.rows.map((row) => this.mapVersion(row));
  }

  async getVersionById(promptVersionId: string): Promise<PromptVersion | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.prompt_version WHERE prompt_version_id = $1`,
      [promptVersionId],
    );
    return rows.rows[0] ? this.mapVersion(rows.rows[0]) : null;
  }

  async createVersion(input: CreatePromptVersionInput): Promise<PromptVersion> {
    const next = await this.db.query<{ next: number }>(
      `SELECT COALESCE(MAX(version_number),0)+1 AS next FROM app.prompt_version WHERE template_id = $1`,
      [input.templateId],
    );
    const rows = await this.db.query<Record<string, unknown>>(
      `INSERT INTO app.prompt_version (template_id, version_number, content, schema_version, tags_json)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
      [
        input.templateId,
        next.rows[0]?.next ?? 1,
        input.content,
        input.schemaVersion ?? null,
        JSON.stringify(input.tags ?? []),
      ],
    );
    return this.mapVersion(rows.rows[0]!);
  }

  async updateVersion(
    promptVersionId: string,
    input: UpdatePromptVersionInput,
  ): Promise<PromptVersion> {
    const current = await this.getVersionById(promptVersionId);
    if (!current) {
      throw new Error(`prompt version not found: ${promptVersionId}`);
    }
    if (current.status !== 'DRAFT') {
      throw new Error('only DRAFT prompt versions can be edited');
    }

    const rows = await this.db.query<Record<string, unknown>>(
      `UPDATE app.prompt_version
       SET content = $2,
           schema_version = $3,
           tags_json = $4::jsonb,
           updated_at = NOW()
       WHERE prompt_version_id = $1
       RETURNING *`,
      [
        promptVersionId,
        input.content ?? current.content,
        input.schemaVersion !== undefined ? input.schemaVersion : current.schemaVersion ?? null,
        JSON.stringify(input.tags ?? current.tags),
      ],
    );
    return this.mapVersion(rows.rows[0]!);
  }

  async getVersionContent(promptVersionId: string): Promise<string | null> {
    const version = await this.getVersionById(promptVersionId);
    return version?.content ?? null;
  }

  async exportPublishedContent(templateId: string): Promise<PromptContentExport | null> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      return null;
    }

    const pack = await this.getPackById(template.promptPackId);
    if (!pack) {
      return null;
    }

    const versions = await this.listVersions(templateId);
    const published = versions.find((version) => version.status === 'PUBLISHED');
    if (!published) {
      return null;
    }

    return {
      pack_key: pack.packKey,
      template_key: template.templateKey,
      template_type: template.templateType,
      schema_version: published.schemaVersion,
      content: published.content,
      metadata: toPromptContentMetadata(published.content),
    };
  }

  private mapPack(row: Record<string, unknown>): PromptPack {
    return {
      promptPackId: row.prompt_pack_id as string,
      packKey: row.pack_key as string,
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  private mapTemplate(row: Record<string, unknown>): PromptTemplate {
    return {
      templateId: row.template_id as string,
      promptPackId: row.prompt_pack_id as string,
      templateKey: row.template_key as string,
      templateType: row.template_type as string,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  private mapVersion(row: Record<string, unknown>): PromptVersion {
    return {
      promptVersionId: row.prompt_version_id as string,
      templateId: row.template_id as string,
      versionNumber: row.version_number as number,
      status: row.status as PromptVersion['status'],
      content: row.content as string,
      schemaVersion: (row.schema_version as string) ?? undefined,
      tags: parseJson<string[]>(row.tags_json, []),
      publishedAt: row.published_at ? toIso(row.published_at) : undefined,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }
}
