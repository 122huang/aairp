import type { DatabaseClient } from '../persistence/clients.js';
import type {
  CreateRegulationInput,
  CreateRegulationVersionInput,
  IRegulationRepository,
  PackVersionStatus,
  PaginatedResult,
  PaginationParams,
  Regulation,
  RegulationVersion,
  UpdateRegulationVersionInput,
} from '@aairp/shared-kernel';
import { normalizePagination, parseJson, toIso } from './pg-utils.js';

type RegulationRow = {
  regulation_id: string;
  regulation_key: string;
  jurisdiction: string;
  created_at: Date;
  updated_at: Date;
};

type RegulationVersionRow = {
  regulation_version_id: string;
  regulation_id: string;
  version_number: number;
  status: PackVersionStatus;
  law_name: string;
  article: string | null;
  source_url: string | null;
  body_text: string | null;
  tags_json: unknown;
  search_text: string | null;
  effective_date: Date | string | null;
  mandatory: boolean | null;
  risk_level: string | null;
  owner: string | null;
  owner_type: string | null;
  last_reviewed_at: Date | null;
  freshness_status: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function mapRegulation(row: RegulationRow): Regulation {
  return {
    regulationId: row.regulation_id,
    regulationKey: row.regulation_key,
    jurisdiction: row.jurisdiction,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapVersion(row: RegulationVersionRow): RegulationVersion {
  return {
    regulationVersionId: row.regulation_version_id,
    regulationId: row.regulation_id,
    versionNumber: row.version_number,
    status: row.status,
    lawName: row.law_name,
    article: row.article ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    bodyText: row.body_text ?? undefined,
    tags: parseJson<string[]>(row.tags_json, []),
    searchText: row.search_text ?? undefined,
    effectiveDate: row.effective_date
      ? typeof row.effective_date === 'string'
        ? row.effective_date
        : row.effective_date.toISOString().slice(0, 10)
      : undefined,
    mandatory: row.mandatory ?? undefined,
    riskLevel: row.risk_level ?? undefined,
    owner: row.owner ?? undefined,
    ownerType: row.owner_type ?? undefined,
    lastReviewedAt: row.last_reviewed_at ? toIso(row.last_reviewed_at) : undefined,
    freshnessStatus: row.freshness_status ?? undefined,
    publishedAt: row.published_at ? toIso(row.published_at) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export class PgRegulationRepository implements IRegulationRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listRegulations(
    params: PaginationParams & { jurisdiction?: string; q?: string },
  ): Promise<PaginatedResult<Regulation>> {
    const { limit, offset } = normalizePagination(params);
    const conditions: string[] = [];
    const queryParams: unknown[] = [];
    let idx = 1;

    if (params.jurisdiction) {
      conditions.push(`jurisdiction = $${idx++}`);
      queryParams.push(params.jurisdiction);
    }
    if (params.q) {
      conditions.push(
        `(regulation_key ILIKE '%' || $${idx} || '%' OR jurisdiction ILIKE '%' || $${idx} || '%')`,
      );
      queryParams.push(params.q);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app.regulation ${where}`,
      queryParams,
    );

    queryParams.push(limit, offset);
    const rows = await this.db.query<RegulationRow>(
      `SELECT * FROM app.regulation ${where}
       ORDER BY updated_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      queryParams,
    );

    return {
      items: rows.rows.map(mapRegulation),
      total: Number(count.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async createRegulation(input: CreateRegulationInput): Promise<Regulation> {
    const rows = await this.db.query<RegulationRow>(
      `INSERT INTO app.regulation (regulation_key, jurisdiction)
       VALUES ($1, $2)
       RETURNING *`,
      [input.regulationKey, input.jurisdiction],
    );
    return mapRegulation(rows.rows[0]!);
  }

  async getRegulationById(regulationId: string): Promise<Regulation | null> {
    const rows = await this.db.query<RegulationRow>(
      `SELECT * FROM app.regulation WHERE regulation_id = $1`,
      [regulationId],
    );
    return rows.rows[0] ? mapRegulation(rows.rows[0]) : null;
  }

  async getRegulationByKey(regulationKey: string): Promise<Regulation | null> {
    const rows = await this.db.query<RegulationRow>(
      `SELECT * FROM app.regulation WHERE regulation_key = $1`,
      [regulationKey],
    );
    return rows.rows[0] ? mapRegulation(rows.rows[0]) : null;
  }

  async listVersions(
    regulationId: string,
    status?: PackVersionStatus,
  ): Promise<RegulationVersion[]> {
    const rows = status
      ? await this.db.query<RegulationVersionRow>(
          `SELECT * FROM app.regulation_version
           WHERE regulation_id = $1 AND status = $2
           ORDER BY version_number DESC`,
          [regulationId, status],
        )
      : await this.db.query<RegulationVersionRow>(
          `SELECT * FROM app.regulation_version
           WHERE regulation_id = $1
           ORDER BY version_number DESC`,
          [regulationId],
        );
    return rows.rows.map(mapVersion);
  }

  async getVersionById(regulationVersionId: string): Promise<RegulationVersion | null> {
    const rows = await this.db.query<RegulationVersionRow>(
      `SELECT * FROM app.regulation_version WHERE regulation_version_id = $1`,
      [regulationVersionId],
    );
    return rows.rows[0] ? mapVersion(rows.rows[0]) : null;
  }

  async createVersion(input: CreateRegulationVersionInput): Promise<RegulationVersion> {
    const next = await this.db.query<{ next: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next
       FROM app.regulation_version WHERE regulation_id = $1`,
      [input.regulationId],
    );
    const versionNumber = next.rows[0]?.next ?? 1;
    const searchText =
      input.searchText ??
      [input.lawName, input.article, input.bodyText].filter(Boolean).join(' ');

    const rows = await this.db.query<RegulationVersionRow>(
      `INSERT INTO app.regulation_version
         (regulation_id, version_number, law_name, article, source_url, body_text, tags_json, search_text,
          effective_date, mandatory, risk_level, owner, owner_type, last_reviewed_at, freshness_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        input.regulationId,
        versionNumber,
        input.lawName,
        input.article ?? null,
        input.sourceUrl ?? null,
        input.bodyText ?? null,
        JSON.stringify(input.tags ?? []),
        searchText,
        input.effectiveDate ?? null,
        input.mandatory ?? null,
        input.riskLevel ?? null,
        input.owner ?? null,
        input.ownerType ?? null,
        input.lastReviewedAt ?? null,
        input.freshnessStatus ?? null,
      ],
    );
    return mapVersion(rows.rows[0]!);
  }

  async updateVersion(
    regulationVersionId: string,
    input: UpdateRegulationVersionInput,
  ): Promise<RegulationVersion> {
    const current = await this.getVersionById(regulationVersionId);
    if (!current) {
      throw new Error(`regulation version not found: ${regulationVersionId}`);
    }
    if (current.status !== 'DRAFT') {
      throw new Error('only DRAFT regulation versions can be edited');
    }

    const lawName = input.lawName ?? current.lawName;
    const article = input.article !== undefined ? input.article : current.article;
    const sourceUrl = input.sourceUrl !== undefined ? input.sourceUrl : current.sourceUrl;
    const bodyText = input.bodyText !== undefined ? input.bodyText : current.bodyText;
    const tags = input.tags ?? current.tags;
    const searchText =
      input.searchText ??
      [lawName, article, bodyText].filter(Boolean).join(' ');
    const effectiveDate =
      input.effectiveDate !== undefined ? input.effectiveDate : current.effectiveDate;
    const mandatory = input.mandatory !== undefined ? input.mandatory : current.mandatory;
    const riskLevel = input.riskLevel !== undefined ? input.riskLevel : current.riskLevel;

    const rows = await this.db.query<RegulationVersionRow>(
      `UPDATE app.regulation_version
       SET law_name = $2,
           article = $3,
           source_url = $4,
           body_text = $5,
           tags_json = $6::jsonb,
           search_text = $7,
           effective_date = $8,
           mandatory = $9,
           risk_level = $10,
           updated_at = NOW()
       WHERE regulation_version_id = $1
       RETURNING *`,
      [
        regulationVersionId,
        lawName,
        article ?? null,
        sourceUrl ?? null,
        bodyText ?? null,
        JSON.stringify(tags),
        searchText,
        effectiveDate ?? null,
        mandatory ?? null,
        riskLevel ?? null,
      ],
    );
    return mapVersion(rows.rows[0]!);
  }

  async linkRuleVersion(
    ruleVersionId: string,
    regulationVersionId: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO app.rule_version_regulation (rule_version_id, regulation_version_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [ruleVersionId, regulationVersionId],
    );
  }
}
