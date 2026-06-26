import type { DatabaseClient } from '../persistence/clients.js';
import type { CaseEmbeddingRecord, ICaseEmbeddingRepository } from '@aairp/shared-kernel';
import { parseJson, toIso } from '../knowledge/pg-utils.js';

type CaseEmbeddingRow = Record<string, unknown>;

export class PgCaseEmbeddingRepository implements ICaseEmbeddingRepository {
  constructor(private readonly db: DatabaseClient) {}

  async upsert(record: CaseEmbeddingRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO app.case_embedding (
         case_id, case_version, embedding_model, embedding_json, embed_text, dimensions, created_at
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (case_id, case_version, embedding_model)
       DO UPDATE SET
         embedding_json = EXCLUDED.embedding_json,
         embed_text = EXCLUDED.embed_text,
         dimensions = EXCLUDED.dimensions,
         created_at = EXCLUDED.created_at`,
      [
        record.case_id,
        record.case_version,
        record.embedding_model,
        JSON.stringify(record.embedding),
        record.embed_text,
        record.dimensions,
        record.created_at,
      ],
    );
  }

  async findByCaseId(caseId: string, embeddingModel: string): Promise<CaseEmbeddingRecord | null> {
    const rows = await this.db.query<CaseEmbeddingRow>(
      `SELECT *
       FROM app.case_embedding
       WHERE case_id = $1 AND embedding_model = $2
       ORDER BY case_version DESC
       LIMIT 1`,
      [caseId, embeddingModel],
    );
    return rows.rows[0] ? this.mapRow(rows.rows[0]) : null;
  }

  async findByCaseIds(caseIds: string[], embeddingModel: string): Promise<CaseEmbeddingRecord[]> {
    if (caseIds.length === 0) {
      return [];
    }

    const rows = await this.db.query<CaseEmbeddingRow>(
      `SELECT DISTINCT ON (case_id) *
       FROM app.case_embedding
       WHERE embedding_model = $1
         AND case_id = ANY($2::text[])
       ORDER BY case_id, case_version DESC`,
      [embeddingModel, caseIds],
    );

    return rows.rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: CaseEmbeddingRow): CaseEmbeddingRecord {
    return {
      case_id: String(row.case_id),
      case_version: Number(row.case_version),
      embedding_model: String(row.embedding_model),
      embedding: parseJson<number[]>(row.embedding_json, []),
      embed_text: String(row.embed_text),
      dimensions: Number(row.dimensions),
      created_at: toIso(row.created_at),
    };
  }
}
