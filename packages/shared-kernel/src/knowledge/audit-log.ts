import type { PaginatedResult, PaginationParams } from './common.js';

export type AuditEvent = {
  auditEventId: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  traceId?: string;
  occurredAt: string;
};

export type RecordAuditEventInput = {
  actor?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload?: Record<string, unknown>;
  traceId?: string;
};

export type AuditSearchFilters = PaginationParams & {
  resourceType?: string;
  resourceId?: string;
  action?: string;
  traceId?: string;
  from?: string;
  to?: string;
};

export type IAuditLogRepository = {
  record(input: RecordAuditEventInput): Promise<AuditEvent>;
  search(filters: AuditSearchFilters): Promise<PaginatedResult<AuditEvent>>;
  findById(auditEventId: string): Promise<AuditEvent | null>;
};
