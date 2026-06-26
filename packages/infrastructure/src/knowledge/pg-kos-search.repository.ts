import type { DatabaseClient } from '../persistence/clients.js';
import type {
  IKosSearchRepository,
  KosSearchFilters,
  KosSearchHit,
  KosSearchResult,
} from '@aairp/shared-kernel';

type RuleSearchRow = {
  rule_version_id: string;
  rule_id: string;
  rule_key: string;
  display_name: string | null;
  summary: string;
  status: string;
  severity: string;
  decision: string;
  scope_json: unknown;
};

type CaseSearchRow = {
  case_id: string;
  review_id: string;
  country_id: string | null;
  category_id: string | null;
  final_decision: string | null;
  lifecycle_status: string;
  search_text: string | null;
};

type RegulationSearchRow = {
  regulation_version_id: string;
  regulation_id: string;
  regulation_key: string;
  jurisdiction: string;
  law_name: string;
  article: string | null;
  status: string;
  search_text: string | null;
};

function mapRegulationRow(row: RegulationSearchRow): KosSearchHit {
  return {
    objectType: 'regulation',
    objectId: row.regulation_version_id,
    title: row.law_name,
    snippet: row.article ?? row.search_text ?? undefined,
    meta: {
      regulation_id: row.regulation_id,
      regulation_key: row.regulation_key,
      jurisdiction: row.jurisdiction,
      status: row.status,
      source: 'postgres',
    },
  };
}

function mapRuleRow(row: RuleSearchRow): KosSearchHit {
  const scope =
    typeof row.scope_json === 'object' && row.scope_json !== null
      ? (row.scope_json as { countries?: string[]; categories?: string[] })
      : { countries: [], categories: [] };

  return {
    objectType: 'rule',
    objectId: row.rule_version_id,
    title: row.display_name?.trim() || row.rule_key,
    snippet: row.summary,
    meta: {
      rule_id: row.rule_id,
      rule_key: row.rule_key,
      status: row.status,
      severity: row.severity,
      decision: row.decision,
      countries: scope.countries ?? [],
      categories: scope.categories ?? [],
      source: 'postgres',
    },
  };
}

function mapCaseRow(row: CaseSearchRow): KosSearchHit {
  return {
    objectType: 'case',
    objectId: row.case_id,
    title: row.case_id,
    snippet: row.search_text ?? undefined,
    meta: {
      review_id: row.review_id,
      country_id: row.country_id ?? undefined,
      category_id: row.category_id ?? undefined,
      final_decision: row.final_decision ?? undefined,
      lifecycle_status: row.lifecycle_status,
      source: 'postgres',
    },
  };
}

export class PgKosSearchRepository implements IKosSearchRepository {
  constructor(private readonly db: DatabaseClient) {}

  async searchRules(
    filters: Omit<KosSearchFilters, 'type'>,
  ): Promise<KosSearchResult> {
    const params: unknown[] = [
      filters.q ?? null,
      filters.countryId ?? null,
      filters.categoryId ?? null,
      filters.status ?? null,
      filters.severity ?? null,
    ];
    const where = [
      `($1::text IS NULL OR rv.summary ILIKE '%' || $1 || '%'
        OR rd.rule_key ILIKE '%' || $1 || '%'
        OR coalesce(rd.display_name, '') ILIKE '%' || $1 || '%')`,
      `($2::text IS NULL OR rv.scope_json->'countries' @> to_jsonb(ARRAY[$2]::text[]))`,
      `($3::text IS NULL OR rv.scope_json->'categories' @> to_jsonb(ARRAY[$3]::text[]))`,
      `($4::text IS NULL OR rv.status::text = $4)`,
      `($5::text IS NULL OR rv.severity = $5)`,
    ].join(' AND ');

    const countRows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM app.rule_version rv
       INNER JOIN app.rule_definition rd ON rd.rule_id = rv.rule_id
       WHERE ${where}`,
      params,
    );

    params.push(filters.limit, filters.offset);
    const rows = await this.db.query<RuleSearchRow>(
      `SELECT
         rv.rule_version_id,
         rd.rule_id,
         rd.rule_key,
         rd.display_name,
         rv.summary,
         rv.status::text AS status,
         rv.severity,
         rv.decision,
         rv.scope_json
       FROM app.rule_version rv
       INNER JOIN app.rule_definition rd ON rd.rule_id = rv.rule_id
       WHERE ${where}
       ORDER BY rv.updated_at DESC
       LIMIT $6 OFFSET $7`,
      params,
    );

    return {
      items: rows.rows.map(mapRuleRow),
      total: Number(countRows.rows[0]?.count ?? 0),
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async searchCasesInDb(
    filters: Omit<KosSearchFilters, 'type'>,
  ): Promise<KosSearchResult> {
    const params: unknown[] = [
      filters.q ?? null,
      filters.countryId ?? null,
      filters.categoryId ?? null,
    ];
    const where = [
      `($1::text IS NULL OR coalesce(cr.search_text, '') ILIKE '%' || $1 || '%'
        OR cr.case_id ILIKE '%' || $1 || '%'
        OR cr.review_id ILIKE '%' || $1 || '%')`,
      `($2::text IS NULL OR cr.country_id = $2)`,
      `($3::text IS NULL OR cr.category_id = $3)`,
    ].join(' AND ');

    const countRows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app.case_record cr WHERE ${where}`,
      params,
    );

    params.push(filters.limit, filters.offset);
    const rows = await this.db.query<CaseSearchRow>(
      `SELECT
         cr.case_id,
         cr.review_id,
         cr.country_id,
         cr.category_id,
         cr.final_decision,
         cr.lifecycle_status,
         cr.search_text
       FROM app.case_record cr
       WHERE ${where}
       ORDER BY cr.updated_at DESC
       LIMIT $4 OFFSET $5`,
      params,
    );

    return {
      items: rows.rows.map(mapCaseRow),
      total: Number(countRows.rows[0]?.count ?? 0),
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async searchRegulations(
    filters: Omit<KosSearchFilters, 'type'>,
  ): Promise<KosSearchResult> {
    const params: unknown[] = [
      filters.q ?? null,
      filters.jurisdiction ?? filters.countryId ?? null,
    ];
    const where = [
      `($1::text IS NULL OR coalesce(rv.search_text, '') ILIKE '%' || $1 || '%'
        OR rv.law_name ILIKE '%' || $1 || '%'
        OR coalesce(rv.article, '') ILIKE '%' || $1 || '%'
        OR r.regulation_key ILIKE '%' || $1 || '%')`,
      `($2::text IS NULL OR r.jurisdiction = $2)`,
    ].join(' AND ');

    const countRows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM app.regulation_version rv
       INNER JOIN app.regulation r ON r.regulation_id = rv.regulation_id
       WHERE ${where}`,
      params,
    );

    params.push(filters.limit, filters.offset);
    const rows = await this.db.query<RegulationSearchRow>(
      `SELECT
         rv.regulation_version_id,
         r.regulation_id,
         r.regulation_key,
         r.jurisdiction,
         rv.law_name,
         rv.article,
         rv.status::text AS status,
         rv.search_text
       FROM app.regulation_version rv
       INNER JOIN app.regulation r ON r.regulation_id = rv.regulation_id
       WHERE ${where}
       ORDER BY rv.updated_at DESC
       LIMIT $3 OFFSET $4`,
      params,
    );

    return {
      items: rows.rows.map(mapRegulationRow),
      total: Number(countRows.rows[0]?.count ?? 0),
      limit: filters.limit,
      offset: filters.offset,
    };
  }
}
