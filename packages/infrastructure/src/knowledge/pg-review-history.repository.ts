import type { DatabaseClient } from '../persistence/clients.js';
import type {
  CreateReviewRunInput,
  IReviewHistoryRepository,
  PaginatedResult,
  ReviewRunRecord,
  ReviewSearchFilters,
} from '@aairp/shared-kernel';
import { normalizePagination, parseJson, toIso } from './pg-utils.js';

export class PgReviewHistoryRepository implements IReviewHistoryRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateReviewRunInput): Promise<ReviewRunRecord> {
    const existing = await this.findByReviewId(input.reviewId);
    if (existing) {
      return existing;
    }

    const rows = await this.db.query<{ review_run_id: string }>(
      `INSERT INTO app.review_run
         (review_id, advertisement_id, tenant_id, country_id, platform_id, category_id,
          content_hash, ad_text_preview, ai_decision, final_decision, confidence,
          rationale, finding_counts_json, report_html, metadata_json, reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15::jsonb,$16)
       RETURNING review_run_id`,
      [
        input.reviewId,
        input.advertisementId,
        input.tenantId ?? 'demo',
        input.countryId,
        input.platformId,
        input.categoryId,
        input.contentHash ?? null,
        input.adTextPreview ?? null,
        input.aiDecision,
        input.finalDecision,
        input.confidence,
        input.rationale ?? null,
        JSON.stringify(input.findingCounts ?? { rule: 0, playbook: 0, llm: 0, case: 0 }),
        input.reportHtml ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.reviewedAt,
      ],
    );

    const reviewRunId = rows.rows[0]!.review_run_id;
    for (const ref of input.findingRefs ?? []) {
      await this.db.query(
        `INSERT INTO app.review_finding_ref
           (review_run_id, module, ref_id, severity, decision, summary)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          reviewRunId,
          ref.module,
          ref.refId,
          ref.severity ?? null,
          ref.decision ?? null,
          ref.summary ?? null,
        ],
      );
    }

    const record = await this.findByReviewId(input.reviewId);
    return record!;
  }

  async findByReviewId(reviewId: string): Promise<ReviewRunRecord | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.review_run WHERE review_id = $1`,
      [reviewId],
    );
    const row = rows.rows[0];
    if (!row) {
      return null;
    }
    return this.hydrate(row);
  }

  async search(filters: ReviewSearchFilters): Promise<PaginatedResult<ReviewRunRecord>> {
    const { limit, offset } = normalizePagination(filters);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.countryId) {
      conditions.push(`country_id = $${idx++}`);
      params.push(filters.countryId);
    }
    if (filters.categoryId) {
      conditions.push(`category_id = $${idx++}`);
      params.push(filters.categoryId);
    }
    if (filters.platformId) {
      conditions.push(`platform_id = $${idx++}`);
      params.push(filters.platformId);
    }
    if (filters.finalDecision) {
      conditions.push(`final_decision = $${idx++}`);
      params.push(filters.finalDecision);
    }
    if (filters.reviewId) {
      conditions.push(`review_id = $${idx++}`);
      params.push(filters.reviewId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app.review_run ${where}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.review_run ${where}
       ORDER BY reviewed_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );

    const items: ReviewRunRecord[] = [];
    for (const row of rows.rows) {
      items.push(await this.hydrate(row));
    }

    return { items, total: Number(count.rows[0]?.count ?? 0), limit, offset };
  }

  private async hydrate(row: Record<string, unknown>): Promise<ReviewRunRecord> {
    const reviewRunId = row.review_run_id as string;
    const refs = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.review_finding_ref WHERE review_run_id = $1`,
      [reviewRunId],
    );

    return {
      reviewRunId,
      reviewId: row.review_id as string,
      advertisementId: row.advertisement_id as string,
      tenantId: row.tenant_id as string,
      countryId: row.country_id as string,
      platformId: row.platform_id as string,
      categoryId: row.category_id as string,
      contentHash: (row.content_hash as string) ?? undefined,
      adTextPreview: (row.ad_text_preview as string) ?? undefined,
      aiDecision: row.ai_decision as string,
      finalDecision: row.final_decision as string,
      confidence: Number(row.confidence),
      rationale: (row.rationale as string) ?? undefined,
      findingCounts: parseJson(row.finding_counts_json, { rule: 0, playbook: 0, llm: 0, case: 0 }),
      reportHtml: (row.report_html as string) ?? undefined,
      metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
      reviewedAt: toIso(row.reviewed_at),
      createdAt: toIso(row.created_at),
      findingRefs: refs.rows.map((r) => ({
        findingRefId: r.finding_ref_id as string,
        module: r.module as string,
        refId: r.ref_id as string,
        severity: (r.severity as string) ?? undefined,
        decision: (r.decision as string) ?? undefined,
        summary: (r.summary as string) ?? undefined,
      })),
    };
  }
}
