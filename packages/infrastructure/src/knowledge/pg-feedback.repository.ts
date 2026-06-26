import type { DatabaseClient } from '../persistence/clients.js';
import type {
  CreateFeedbackInput,
  FeedbackRecord,
  FeedbackSearchFilters,
  FeedbackStatus,
  FeedbackUpsertResult,
  IFeedbackRepository,
  PaginatedResult,
  UpdateFeedbackInput,
} from '@aairp/shared-kernel';
import { normalizePagination, parseJson, toIso } from './pg-utils.js';

export class PgFeedbackRepository implements IFeedbackRepository {
  constructor(private readonly db: DatabaseClient) {}

  async create(input: CreateFeedbackInput): Promise<FeedbackRecord> {
    const rows = await this.db.query<Record<string, unknown>>(
      `INSERT INTO app.feedback
         (review_id, case_id, pilot_id, decision, ratings_json, comment, reviewer_id, metadata_json)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb)
       RETURNING *`,
      [
        input.reviewId ?? null,
        input.caseId ?? null,
        input.pilotId ?? null,
        input.decision ?? null,
        JSON.stringify(input.ratings ?? {}),
        input.comment ?? null,
        input.reviewerId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return this.map(rows.rows[0]!);
  }

  async update(input: UpdateFeedbackInput): Promise<FeedbackRecord> {
    const current = await this.findById(input.feedbackId);
    if (!current) {
      throw new Error(`feedback not found: ${input.feedbackId}`);
    }

    const rows = await this.db.query<Record<string, unknown>>(
      `UPDATE app.feedback
       SET status = COALESCE($2, status),
           decision = COALESCE($3, decision),
           comment = COALESCE($4, comment),
           ratings_json = COALESCE($5::jsonb, ratings_json),
           metadata_json = COALESCE($6::jsonb, metadata_json),
           updated_at = NOW()
       WHERE feedback_id = $1
       RETURNING *`,
      [
        input.feedbackId,
        input.status ?? null,
        input.decision ?? null,
        input.comment ?? null,
        input.ratings ? JSON.stringify(input.ratings) : null,
        input.metadata ? JSON.stringify({ ...current.metadata, ...input.metadata }) : null,
      ],
    );
    return this.map(rows.rows[0]!);
  }

  async findById(feedbackId: string): Promise<FeedbackRecord | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.feedback WHERE feedback_id = $1`,
      [feedbackId],
    );
    return rows.rows[0] ? this.map(rows.rows[0]) : null;
  }

  async findByCaseId(caseId: string): Promise<FeedbackRecord | null> {
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.feedback WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [caseId],
    );
    return rows.rows[0] ? this.map(rows.rows[0]) : null;
  }

  async search(filters: FeedbackSearchFilters): Promise<PaginatedResult<FeedbackRecord>> {
    const { limit, offset } = normalizePagination(filters);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.reviewId) {
      conditions.push(`review_id = $${idx++}`);
      params.push(filters.reviewId);
    }
    if (filters.caseId) {
      conditions.push(`case_id = $${idx++}`);
      params.push(filters.caseId);
    }
    if (filters.pilotId) {
      conditions.push(`pilot_id = $${idx++}`);
      params.push(filters.pilotId);
    }
    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      params.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app.feedback ${where}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM app.feedback ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );

    return {
      items: rows.rows.map((row) => this.map(row)),
      total: Number(count.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async upsertByCaseId(input: CreateFeedbackInput): Promise<FeedbackUpsertResult> {
    if (!input.caseId) {
      throw new Error('caseId is required for feedback upsert');
    }

    const existing = await this.findByCaseId(input.caseId);
    if (!existing) {
      const record = await this.create(input);
      return { record, created: true };
    }

    const record = await this.update({
      feedbackId: existing.feedbackId,
      decision: input.decision,
      comment: input.comment,
      ratings: input.ratings,
      metadata: input.metadata,
    });
    return { record, created: false };
  }

  private map(row: Record<string, unknown>): FeedbackRecord {
    return {
      feedbackId: row.feedback_id as string,
      reviewId: (row.review_id as string) ?? undefined,
      caseId: (row.case_id as string) ?? undefined,
      pilotId: (row.pilot_id as string) ?? undefined,
      status: row.status as FeedbackStatus,
      decision: (row.decision as string) ?? undefined,
      ratings: parseJson<Record<string, number>>(row.ratings_json, {}),
      comment: (row.comment as string) ?? undefined,
      reviewerId: (row.reviewer_id as string) ?? undefined,
      metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }
}
