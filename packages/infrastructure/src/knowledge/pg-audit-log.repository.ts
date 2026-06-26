import type { DatabaseClient } from '../persistence/clients.js';
import type {
  AuditEvent,
  AuditSearchFilters,
  IAuditLogRepository,
  PaginatedResult,
  RecordAuditEventInput,
} from '@aairp/shared-kernel';
import { normalizePagination, parseJson, toIso } from './pg-utils.js';

type AuditRow = {
  audit_event_id: string;
  actor: string;
  action: string;
  resource_type: string;
  resource_id: string;
  payload_json: unknown;
  trace_id: string | null;
  occurred_at: Date;
};

function mapRow(row: AuditRow): AuditEvent {
  return {
    auditEventId: row.audit_event_id,
    actor: row.actor,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    traceId: row.trace_id ?? undefined,
    occurredAt: toIso(row.occurred_at),
  };
}

export class PgAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: DatabaseClient) {}

  async record(input: RecordAuditEventInput, db?: DatabaseClient): Promise<AuditEvent> {
    const executor = db ?? this.db;
    const rows = await executor.query<AuditRow>(
      `INSERT INTO audit.audit_event (actor, action, resource_type, resource_id, payload_json, trace_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING *`,
      [
        input.actor ?? 'system',
        input.action,
        input.resourceType,
        input.resourceId,
        JSON.stringify(input.payload ?? {}),
        input.traceId ?? null,
      ],
    );
    return mapRow(rows.rows[0]!);
  }

  async search(filters: AuditSearchFilters): Promise<PaginatedResult<AuditEvent>> {
    const { limit, offset } = normalizePagination(filters);
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.resourceType) {
      conditions.push(`resource_type = $${idx++}`);
      params.push(filters.resourceType);
    }
    if (filters.resourceId) {
      conditions.push(`resource_id = $${idx++}`);
      params.push(filters.resourceId);
    }
    if (filters.action) {
      conditions.push(`action = $${idx++}`);
      params.push(filters.action);
    }
    if (filters.traceId) {
      conditions.push(`trace_id = $${idx++}`);
      params.push(filters.traceId);
    }
    if (filters.from) {
      conditions.push(`occurred_at >= $${idx++}`);
      params.push(filters.from);
    }
    if (filters.to) {
      conditions.push(`occurred_at <= $${idx++}`);
      params.push(filters.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const count = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM audit.audit_event ${where}`,
      params,
    );
    params.push(limit, offset);
    const rows = await this.db.query<AuditRow>(
      `SELECT * FROM audit.audit_event ${where}
       ORDER BY occurred_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      params,
    );

    return {
      items: rows.rows.map(mapRow),
      total: Number(count.rows[0]?.count ?? 0),
      limit,
      offset,
    };
  }

  async findById(auditEventId: string): Promise<AuditEvent | null> {
    const rows = await this.db.query<AuditRow>(
      `SELECT * FROM audit.audit_event WHERE audit_event_id = $1`,
      [auditEventId],
    );
    return rows.rows[0] ? mapRow(rows.rows[0]) : null;
  }
}
