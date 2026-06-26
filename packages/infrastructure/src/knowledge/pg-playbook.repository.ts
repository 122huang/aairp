import type { DatabaseClient } from '../persistence/clients.js';
import type {
  CreatePlaybookPackInput,
  CreatePlaybookPatternInput,
  CreatePlaybookVersionInput,
  IPlaybookRepository,
  PaginatedResult,
  PaginationParams,
  PlaybookMarkdownExport,
  PlaybookPack,
  PlaybookPackVersion,
  PlaybookPattern,
  UpdatePlaybookPatternInput,
} from '@aairp/shared-kernel';
import { renderPlaybookMarkdown } from '@aairp/shared-kernel';
import { normalizePagination, parseJson, toIso } from './pg-utils.js';

export class PgPlaybookRepository implements IPlaybookRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listPacks(params: PaginationParams): Promise<PaginatedResult<PlaybookPack>> {
    const { limit, offset } = normalizePagination(params);
    const count = await this.db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM app.playbook_pack',
    );
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.playbook_pack ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return {
      items: rows.rows.map((r) => this.mapPack(r)),
      total: Number(count.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async createPack(input: CreatePlaybookPackInput): Promise<PlaybookPack> {
    const rows = await this.db.query<Record<string, unknown>>(
      `INSERT INTO app.playbook_pack (pack_key, name, description) VALUES ($1,$2,$3) RETURNING *`,
      [input.packKey, input.name, input.description ?? null],
    );
    return this.mapPack(rows.rows[0]!);
  }

  async getPackById(playbookPackId: string): Promise<PlaybookPack | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.playbook_pack WHERE playbook_pack_id = $1`,
      [playbookPackId],
    );
    return rows.rows[0] ? this.mapPack(rows.rows[0]) : null;
  }

  async getPackByKey(packKey: string): Promise<PlaybookPack | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.playbook_pack WHERE pack_key = $1`,
      [packKey],
    );
    return rows.rows[0] ? this.mapPack(rows.rows[0]) : null;
  }

  async listPackVersions(playbookPackId: string): Promise<PlaybookPackVersion[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.playbook_pack_version WHERE playbook_pack_id = $1 ORDER BY version_number DESC`,
      [playbookPackId],
    );
    return rows.rows.map((r) => this.mapVersion(r));
  }

  async getVersionById(playbookVersionId: string): Promise<PlaybookPackVersion | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.playbook_pack_version WHERE playbook_version_id = $1`,
      [playbookVersionId],
    );
    return rows.rows[0] ? this.mapVersion(rows.rows[0]) : null;
  }

  async createVersion(input: CreatePlaybookVersionInput): Promise<PlaybookPackVersion> {
    const next = await this.db.query<{ next: number }>(
      `SELECT COALESCE(MAX(version_number),0)+1 AS next FROM app.playbook_pack_version WHERE playbook_pack_id = $1`,
      [input.playbookPackId],
    );
    const rows = await this.db.query<Record<string, unknown>>(
      `INSERT INTO app.playbook_pack_version (playbook_pack_id, version_number)
       VALUES ($1,$2) RETURNING *`,
      [input.playbookPackId, next.rows[0]?.next ?? 1],
    );
    return this.mapVersion(rows.rows[0]!);
  }

  async listPatterns(playbookVersionId: string): Promise<PlaybookPattern[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.playbook_pattern WHERE playbook_version_id = $1 ORDER BY ref_id`,
      [playbookVersionId],
    );
    return rows.rows.map((r) => this.mapPattern(r));
  }

  async getPatternById(patternId: string): Promise<PlaybookPattern | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.playbook_pattern WHERE pattern_id = $1`,
      [patternId],
    );
    return rows.rows[0] ? this.mapPattern(rows.rows[0]) : null;
  }

  async createPattern(input: CreatePlaybookPatternInput): Promise<PlaybookPattern> {
    await this.assertDraftVersion(input.playbookVersionId);
    const rows = await this.db.query<Record<string, unknown>>(
      `INSERT INTO app.playbook_pattern
         (playbook_version_id, ref_id, match_type, terms_json, guidance, markdown_body)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING *`,
      [
        input.playbookVersionId,
        input.refId,
        input.matchType ?? 'terms',
        JSON.stringify(input.terms),
        input.guidance ?? null,
        input.markdownBody ?? null,
      ],
    );
    return this.mapPattern(rows.rows[0]!);
  }

  async updatePattern(
    patternId: string,
    input: UpdatePlaybookPatternInput,
  ): Promise<PlaybookPattern> {
    const current = await this.getPatternById(patternId);
    if (!current) {
      throw new Error(`playbook pattern not found: ${patternId}`);
    }
    await this.assertDraftVersion(current.playbookVersionId);

    const rows = await this.db.query<Record<string, unknown>>(
      `UPDATE app.playbook_pattern
       SET ref_id = $2,
           match_type = $3,
           terms_json = $4::jsonb,
           guidance = $5,
           markdown_body = $6,
           updated_at = NOW()
       WHERE pattern_id = $1
       RETURNING *`,
      [
        patternId,
        input.refId ?? current.refId,
        input.matchType ?? current.matchType,
        JSON.stringify(input.terms ?? current.terms),
        input.guidance !== undefined ? input.guidance : current.guidance ?? null,
        input.markdownBody !== undefined ? input.markdownBody : current.markdownBody ?? null,
      ],
    );
    return this.mapPattern(rows.rows[0]!);
  }

  async exportMarkdown(playbookPackId: string): Promise<PlaybookMarkdownExport | null> {
    const pack = await this.getPackById(playbookPackId);
    if (!pack) {
      return null;
    }

    const versions = await this.listPackVersions(playbookPackId);
    const published = versions.find((version) => version.status === 'PUBLISHED');
    if (!published) {
      return null;
    }

    const patterns = await this.listPatterns(published.playbookVersionId);
    const packVersion = `${pack.packKey}-v${published.versionNumber}`;

    return {
      pack_key: pack.packKey,
      pack_version: packVersion,
      title: pack.name,
      markdown: renderPlaybookMarkdown({
        title: pack.name,
        packKey: pack.packKey,
        packVersion,
        patterns,
      }),
    };
  }

  private async assertDraftVersion(playbookVersionId: string): Promise<void> {
    const version = await this.getVersionById(playbookVersionId);
    if (!version) {
      throw new Error(`playbook version not found: ${playbookVersionId}`);
    }
    if (version.status !== 'DRAFT') {
      throw new Error('only DRAFT playbook versions can be edited');
    }
  }

  private mapPack(row: Record<string, unknown>): PlaybookPack {
    return {
      playbookPackId: row.playbook_pack_id as string,
      packKey: row.pack_key as string,
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  private mapVersion(row: Record<string, unknown>): PlaybookPackVersion {
    return {
      playbookVersionId: row.playbook_version_id as string,
      playbookPackId: row.playbook_pack_id as string,
      versionNumber: row.version_number as number,
      status: row.status as PlaybookPackVersion['status'],
      publishedAt: row.published_at ? toIso(row.published_at) : undefined,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  private mapPattern(row: Record<string, unknown>): PlaybookPattern {
    return {
      patternId: row.pattern_id as string,
      playbookVersionId: row.playbook_version_id as string,
      refId: row.ref_id as string,
      matchType: row.match_type as string,
      terms: parseJson<string[]>(row.terms_json, []),
      guidance: (row.guidance as string) ?? undefined,
      markdownBody: (row.markdown_body as string) ?? undefined,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }
}
