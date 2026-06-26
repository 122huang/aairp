import type { DatabaseClient } from '../persistence/clients.js';
import type {
  CreateRuleInput,
  CreateRulePackInput,
  CreateRuleVersionInput,
  IRuleRepository,
  PackVersionStatus,
  PaginatedResult,
  PaginationParams,
  RuleDefinition,
  RulePack,
  RulePackExportBundle,
  RuleScope,
  RuleVersion,
  UpdateRuleVersionInput,
} from '@aairp/shared-kernel';
import { normalizePagination, parseJson, toIso } from './pg-utils.js';

type RulePackRow = {
  rule_pack_id: string;
  pack_key: string;
  name: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
};

type RuleRow = {
  rule_id: string;
  rule_pack_id: string;
  rule_key: string;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
};

type RuleVersionRow = {
  rule_version_id: string;
  rule_id: string;
  version_number: number;
  status: PackVersionStatus;
  severity: string;
  decision: string;
  summary: string;
  scope_json: unknown;
  payload_json: unknown;
  owner: string | null;
  tags: unknown;
  effective_from: Date | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function mapPack(row: RulePackRow): RulePack {
  return {
    rulePackId: row.rule_pack_id,
    packKey: row.pack_key,
    name: row.name,
    description: row.description ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapRule(row: RuleRow): RuleDefinition {
  return {
    ruleId: row.rule_id,
    rulePackId: row.rule_pack_id,
    ruleKey: row.rule_key,
    displayName: row.display_name ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapVersion(row: RuleVersionRow): RuleVersion {
  const scope = parseJson<RuleScope>(row.scope_json, { countries: [], categories: [] });
  return {
    ruleVersionId: row.rule_version_id,
    ruleId: row.rule_id,
    versionNumber: row.version_number,
    status: row.status,
    severity: row.severity,
    decision: row.decision,
    summary: row.summary,
    scope,
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    owner: row.owner ?? undefined,
    tags: parseJson<string[]>(row.tags, []),
    effectiveFrom: row.effective_from ? toIso(row.effective_from) : undefined,
    publishedAt: row.published_at ? toIso(row.published_at) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export class PgRuleRepository implements IRuleRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listPacks(params: PaginationParams): Promise<PaginatedResult<RulePack>> {
    const { limit, offset } = normalizePagination(params);
    const count = await this.db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM app.rule_pack',
    );
    const rows = await this.db.query<RulePackRow>(
      `SELECT * FROM app.rule_pack ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return {
      items: rows.rows.map(mapPack),
      total: Number(count.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async createPack(input: CreateRulePackInput): Promise<RulePack> {
    const rows = await this.db.query<RulePackRow>(
      `INSERT INTO app.rule_pack (pack_key, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.packKey, input.name, input.description ?? null],
    );
    return mapPack(rows.rows[0]!);
  }

  async getPackById(rulePackId: string): Promise<RulePack | null> {
    const rows = await this.db.query<RulePackRow>(
      `SELECT * FROM app.rule_pack WHERE rule_pack_id = $1`,
      [rulePackId],
    );
    return rows.rows[0] ? mapPack(rows.rows[0]) : null;
  }

  async getPackByKey(packKey: string): Promise<RulePack | null> {
    const rows = await this.db.query<RulePackRow>(
      `SELECT * FROM app.rule_pack WHERE pack_key = $1`,
      [packKey],
    );
    return rows.rows[0] ? mapPack(rows.rows[0]) : null;
  }

  async listRules(
    rulePackId: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<RuleDefinition>> {
    const { limit, offset } = normalizePagination(params);
    const count = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app.rule_definition WHERE rule_pack_id = $1`,
      [rulePackId],
    );
    const rows = await this.db.query<RuleRow>(
      `SELECT * FROM app.rule_definition WHERE rule_pack_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [rulePackId, limit, offset],
    );
    return {
      items: rows.rows.map(mapRule),
      total: Number(count.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async createRule(input: CreateRuleInput): Promise<RuleDefinition> {
    const rows = await this.db.query<RuleRow>(
      `INSERT INTO app.rule_definition (rule_pack_id, rule_key, display_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.rulePackId, input.ruleKey, input.displayName ?? null],
    );
    return mapRule(rows.rows[0]!);
  }

  async getRuleById(ruleId: string): Promise<RuleDefinition | null> {
    const rows = await this.db.query<RuleRow>(
      `SELECT * FROM app.rule_definition WHERE rule_id = $1`,
      [ruleId],
    );
    return rows.rows[0] ? mapRule(rows.rows[0]) : null;
  }

  async getRuleByPackAndKey(
    rulePackId: string,
    ruleKey: string,
  ): Promise<RuleDefinition | null> {
    const rows = await this.db.query<RuleRow>(
      `SELECT * FROM app.rule_definition WHERE rule_pack_id = $1 AND rule_key = $2`,
      [rulePackId, ruleKey],
    );
    return rows.rows[0] ? mapRule(rows.rows[0]) : null;
  }

  async listVersions(ruleId: string, status?: PackVersionStatus): Promise<RuleVersion[]> {
    const rows = status
      ? await this.db.query<RuleVersionRow>(
          `SELECT * FROM app.rule_version WHERE rule_id = $1 AND status = $2
           ORDER BY version_number DESC`,
          [ruleId, status],
        )
      : await this.db.query<RuleVersionRow>(
          `SELECT * FROM app.rule_version WHERE rule_id = $1 ORDER BY version_number DESC`,
          [ruleId],
        );
    return rows.rows.map(mapVersion);
  }

  async createVersion(input: CreateRuleVersionInput): Promise<RuleVersion> {
    const next = await this.db.query<{ next: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next
       FROM app.rule_version WHERE rule_id = $1`,
      [input.ruleId],
    );
    const versionNumber = next.rows[0]?.next ?? 1;
    const rows = await this.db.query<RuleVersionRow>(
      `INSERT INTO app.rule_version
         (rule_id, version_number, severity, decision, summary, scope_json, payload_json, owner, tags)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb)
       RETURNING *`,
      [
        input.ruleId,
        versionNumber,
        input.severity,
        input.decision,
        input.summary,
        JSON.stringify(input.scope),
        JSON.stringify(input.payload),
        input.owner ?? null,
        JSON.stringify(input.tags ?? []),
      ],
    );
    return mapVersion(rows.rows[0]!);
  }

  async getVersionById(ruleVersionId: string): Promise<RuleVersion | null> {
    const rows = await this.db.query<RuleVersionRow>(
      `SELECT * FROM app.rule_version WHERE rule_version_id = $1`,
      [ruleVersionId],
    );
    return rows.rows[0] ? mapVersion(rows.rows[0]) : null;
  }

  async updateVersion(
    ruleVersionId: string,
    input: UpdateRuleVersionInput,
  ): Promise<RuleVersion> {
    const current = await this.getVersionById(ruleVersionId);
    if (!current) {
      throw new Error(`rule version not found: ${ruleVersionId}`);
    }
    if (current.status !== 'DRAFT') {
      throw new Error('only DRAFT rule versions can be edited');
    }

    const rows = await this.db.query<RuleVersionRow>(
      `UPDATE app.rule_version
       SET severity = $2,
           decision = $3,
           summary = $4,
           scope_json = $5::jsonb,
           payload_json = $6::jsonb,
           owner = $7,
           tags = $8::jsonb,
           updated_at = NOW()
       WHERE rule_version_id = $1
       RETURNING *`,
      [
        ruleVersionId,
        input.severity ?? current.severity,
        input.decision ?? current.decision,
        input.summary ?? current.summary,
        JSON.stringify(input.scope ?? current.scope),
        JSON.stringify(input.payload ?? current.payload),
        input.owner !== undefined ? input.owner : current.owner ?? null,
        JSON.stringify(input.tags ?? current.tags),
      ],
    );
    return mapVersion(rows.rows[0]!);
  }

  async listRegulationVersionIds(ruleVersionId: string): Promise<string[]> {
    const rows = await this.db.query<{ regulation_version_id: string }>(
      `SELECT regulation_version_id
       FROM app.rule_version_regulation
       WHERE rule_version_id = $1
       ORDER BY created_at`,
      [ruleVersionId],
    );
    return rows.rows.map((row) => row.regulation_version_id);
  }

  async setRegulationVersionLinks(
    ruleVersionId: string,
    regulationVersionIds: string[],
  ): Promise<void> {
    await this.db.query(
      `DELETE FROM app.rule_version_regulation WHERE rule_version_id = $1`,
      [ruleVersionId],
    );
    for (const regulationVersionId of regulationVersionIds) {
      await this.db.query(
        `INSERT INTO app.rule_version_regulation (rule_version_id, regulation_version_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [ruleVersionId, regulationVersionId],
      );
    }
  }

  async exportPack(rulePackId: string): Promise<RulePackExportBundle | null> {
    const pack = await this.getPackById(rulePackId);
    if (!pack) {
      return null;
    }

    const rulesResult = await this.listRules(rulePackId, { limit: 500, offset: 0 });
    const entries = [];

    for (const rule of rulesResult.items) {
      const versions = await this.listVersions(rule.ruleId, 'PUBLISHED');
      const version = versions[0];
      if (!version) {
        continue;
      }

      const payload = version.payload;
      const citation =
        typeof payload.citation === 'object' && payload.citation !== null
          ? (payload.citation as { law_name: string; article?: string })
          : undefined;

      entries.push({
        rule_id: rule.ruleKey,
        rule_version_id: version.ruleVersionId,
        severity: version.severity,
        decision: version.decision,
        summary: version.summary,
        scopes: version.scope,
        ...(Array.isArray(payload.forbidden_terms)
          ? { forbidden_terms: payload.forbidden_terms as string[] }
          : {}),
        ...(Array.isArray(payload.trigger_terms)
          ? { trigger_terms: payload.trigger_terms as string[] }
          : {}),
        ...(Array.isArray(payload.required_any_terms)
          ? { required_any_terms: payload.required_any_terms as string[] }
          : {}),
        ...(citation ? { citation } : {}),
        regulation_version_ids: await this.listRegulationVersionIds(version.ruleVersionId),
      });
    }

    return {
      pack_key: pack.packKey,
      pack_version: `${pack.packKey}-v${entries.length}`,
      rules: entries,
    };
  }
}
