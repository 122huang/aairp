import type { DatabaseClient } from '../persistence/clients.js';
import type {
  CaseKosSearchResult,
  CaseLifecycleStatus,
  CaseManifestEntry,
  CaseRecord,
  CaseSaveResult,
  CaseSearchFilters,
  ICaseKosRepository,
} from '@aairp/shared-kernel';
import {
  buildCaseSearchText,
  buildCaseTextPreview,
  kosCaseStoragePath,
} from '@aairp/shared-kernel';
import { parseJson, toIso } from '../knowledge/pg-utils.js';

type CaseRecordRow = Record<string, unknown>;

export class PgCaseKosRepository implements ICaseKosRepository {
  constructor(private readonly db: DatabaseClient) {}

  async save(record: CaseRecord): Promise<CaseSaveResult> {
    const existing = await this.findByReviewId(record.review_id);
    if (existing) {
      return {
        case_id: existing.case_id,
        path: kosCaseStoragePath(existing.case_id, existing.case_version),
        created: false,
      };
    }

    await this.insertRecord(record);
    return {
      case_id: record.case_id,
      path: kosCaseStoragePath(record.case_id, record.case_version),
      created: true,
    };
  }

  async saveVersion(record: CaseRecord): Promise<CaseSaveResult> {
    const latest = await this.findByCaseId(record.case_id);
    if (!latest) {
      throw new Error(`case not found: ${record.case_id}`);
    }

    const nextVersion = latest.case_version + 1;
    const nextRecord: CaseRecord = {
      ...record,
      case_version: nextVersion,
      updated_at: new Date().toISOString(),
    };

    await this.insertRecord(nextRecord);
    return {
      case_id: nextRecord.case_id,
      path: kosCaseStoragePath(nextRecord.case_id, nextRecord.case_version),
      created: true,
    };
  }

  async findByCaseId(caseId: string, caseVersion?: number): Promise<CaseRecord | null> {
    if (caseVersion !== undefined) {
      const rows = await this.db.query<CaseRecordRow>(
        `SELECT * FROM app.case_record WHERE case_id = $1 AND case_version = $2`,
        [caseId, caseVersion],
      );
      return rows.rows[0] ? this.mapRowToRecord(rows.rows[0]) : null;
    }

    const rows = await this.db.query<CaseRecordRow>(
      `SELECT * FROM app.case_record WHERE case_id = $1 ORDER BY case_version DESC LIMIT 1`,
      [caseId],
    );
    return rows.rows[0] ? this.mapRowToRecord(rows.rows[0]) : null;
  }

  async findByReviewId(reviewId: string): Promise<CaseRecord | null> {
    const rows = await this.db.query<CaseRecordRow>(
      `SELECT * FROM app.case_record WHERE review_id = $1 ORDER BY case_version DESC LIMIT 1`,
      [reviewId],
    );
    return rows.rows[0] ? this.mapRowToRecord(rows.rows[0]) : null;
  }

  async search(filters: CaseSearchFilters): Promise<CaseKosSearchResult> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const params: unknown[] = [];
    const where: string[] = [
      `cr.case_version = (
         SELECT MAX(cr2.case_version) FROM app.case_record cr2 WHERE cr2.case_id = cr.case_id
       )`,
    ];

    if (filters.case_id) {
      params.push(filters.case_id);
      where.push(`cr.case_id = $${params.length}`);
    }
    if (filters.thread_id) {
      params.push(filters.thread_id);
      // Older root cases may omit thread_id; treat missing as case_id.
      where.push(
        `coalesce(nullif(cr.payload_json->>'thread_id', ''), cr.case_id) = $${params.length}`,
      );
    }
    if (filters.country_id) {
      params.push(filters.country_id);
      where.push(`cr.country_id = $${params.length}`);
    }
    if (filters.category_id) {
      params.push(filters.category_id);
      where.push(`cr.category_id = $${params.length}`);
    }
    if (filters.platform_id) {
      params.push(filters.platform_id);
      where.push(`cr.platform_id = $${params.length}`);
    }
    if (filters.ai_decision) {
      params.push(filters.ai_decision);
      where.push(`cr.ai_decision = $${params.length}`);
    }
    if (filters.final_decision) {
      params.push(filters.final_decision);
      where.push(`cr.final_decision = $${params.length}`);
    }
    if (filters.lifecycle_status) {
      params.push(filters.lifecycle_status);
      where.push(`cr.lifecycle_status = $${params.length}`);
    }
    if (filters.review_id) {
      params.push(filters.review_id);
      where.push(`cr.review_id = $${params.length}`);
    }
    if (filters.content_hash) {
      params.push(filters.content_hash);
      where.push(`cr.content_hash = $${params.length}`);
    }
    if (filters.language) {
      params.push(filters.language);
      where.push(`coalesce(cr.payload_json->'advertisement'->'content'->>'language', '') = $${params.length}`);
    }
    if (filters.created_from) {
      params.push(filters.created_from);
      where.push(`cr.created_at >= $${params.length}::timestamptz`);
    }
    if (filters.created_to) {
      params.push(filters.created_to);
      where.push(`cr.created_at <= $${params.length}::timestamptz`);
    }

    const whereClause = where.join(' AND ');
    const countRows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM app.case_record cr
       WHERE ${whereClause}`,
      params,
    );

    params.push(limit, offset);
    const rows = await this.db.query<CaseRecordRow>(
      `SELECT cr.*
       FROM app.case_record cr
       WHERE ${whereClause}
       ORDER BY cr.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      items: rows.rows.map((row) => this.mapRowToManifest(row)),
      total: Number(countRows.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async listLatestManifest(): Promise<CaseManifestEntry[]> {
    const rows = await this.db.query<CaseRecordRow>(
      `SELECT cr.*
       FROM app.case_record cr
       WHERE cr.case_version = (
         SELECT MAX(cr2.case_version) FROM app.case_record cr2 WHERE cr2.case_id = cr.case_id
       )
       ORDER BY cr.updated_at DESC`,
    );
    return rows.rows.map((row) => this.mapRowToManifest(row));
  }

  async listVersions(caseId: string): Promise<CaseManifestEntry[]> {
    const rows = await this.db.query<CaseRecordRow>(
      `SELECT * FROM app.case_record WHERE case_id = $1 ORDER BY case_version DESC`,
      [caseId],
    );
    return rows.rows.map((row) => this.mapRowToManifest(row));
  }

  async exportAllLatest(): Promise<CaseRecord[]> {
    const rows = await this.db.query<CaseRecordRow>(
      `SELECT cr.*
       FROM app.case_record cr
       WHERE cr.case_version = (
         SELECT MAX(cr2.case_version) FROM app.case_record cr2 WHERE cr2.case_id = cr.case_id
       )
       ORDER BY cr.updated_at DESC`,
    );
    return rows.rows.map((row) => this.mapRowToRecord(row));
  }

  async updateLifecycle(
    caseId: string,
    caseVersion: number,
    lifecycleStatus: CaseLifecycleStatus,
    publishedAt?: string | null,
  ): Promise<CaseRecord> {
    const rows = await this.db.query<CaseRecordRow>(
      `UPDATE app.case_record
       SET lifecycle_status = $3,
           published_at = $4,
           updated_at = NOW(),
           payload_json = jsonb_set(payload_json, '{lifecycle_status}', to_jsonb($3::text), true)
       WHERE case_id = $1 AND case_version = $2
       RETURNING *`,
      [caseId, caseVersion, lifecycleStatus, publishedAt ?? null],
    );
    if (!rows.rows[0]) {
      throw new Error(`case version not found: ${caseId} v${caseVersion}`);
    }
    return this.mapRowToRecord(rows.rows[0]);
  }

  async rollbackToVersion(caseId: string, targetVersion: number): Promise<CaseRecord> {
    const target = await this.findByCaseId(caseId, targetVersion);
    if (!target) {
      throw new Error(`case version not found: ${caseId} v${targetVersion}`);
    }

    const latest = await this.findByCaseId(caseId);
    if (!latest) {
      throw new Error(`case not found: ${caseId}`);
    }

    const now = new Date().toISOString();
    const restored: CaseRecord = {
      ...target,
      case_version: latest.case_version + 1,
      lifecycle_status: target.lifecycle_status,
      updated_at: now,
      metadata: {
        ...target.metadata,
        storage_phase: 'postgres',
      },
    };

    await this.insertRecord(restored);
    return restored;
  }

  private async insertRecord(record: CaseRecord): Promise<void> {
    const payload: CaseRecord = {
      ...record,
      metadata: {
        ...record.metadata,
        storage_phase: 'postgres',
      },
    };

    await this.db.query(
      `INSERT INTO app.case_record (
         case_id, case_version, review_id, advertisement_id, lifecycle_status,
         schema_version, tenant_id, country_id, platform_id, category_id,
         content_hash, ai_decision, final_decision, payload_json, search_text
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)`,
      [
        payload.case_id,
        payload.case_version,
        payload.review_id,
        payload.advertisement_id,
        payload.lifecycle_status,
        payload.schema_version,
        payload.dimensions.tenant_id,
        payload.dimensions.country_id,
        payload.dimensions.platform_id,
        payload.dimensions.category_id,
        payload.advertisement.content_hash,
        payload.decision.ai_decision,
        payload.decision.final_decision,
        JSON.stringify(payload),
        buildCaseSearchText(payload),
      ],
    );
  }

  private mapRowToRecord(row: CaseRecordRow): CaseRecord {
    const payload = parseJson<CaseRecord>(row.payload_json, {} as CaseRecord);
    return {
      ...payload,
      case_id: row.case_id as string,
      case_version: row.case_version as number,
      review_id: row.review_id as string,
      lifecycle_status: row.lifecycle_status as CaseRecord['lifecycle_status'],
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  }

  private mapRowToManifest(row: CaseRecordRow): CaseManifestEntry {
    const record = this.mapRowToRecord(row);
    const textPreview = buildCaseTextPreview(record);
    const threadId = record.thread_id?.trim() || record.case_id;
    return {
      case_id: record.case_id,
      case_version: record.case_version,
      path: kosCaseStoragePath(record.case_id, record.case_version),
      review_id: record.review_id,
      country_id: record.dimensions.country_id,
      category_id: record.dimensions.category_id,
      platform_id: record.dimensions.platform_id,
      language: record.advertisement.content.language,
      ai_decision: record.decision.ai_decision,
      final_decision: record.decision.final_decision,
      lifecycle_status: record.lifecycle_status,
      content_hash: record.advertisement.content_hash,
      created_at: record.created_at,
      updated_at: record.updated_at,
      thread_id: threadId,
      ...(textPreview ? { text_preview: textPreview } : {}),
    };
  }
}
