import type { AuditEvent } from '@aairp/shared-kernel';

export type AuditEventDto = {
  audit_event_id: string;
  actor: string;
  action: string;
  resource_type: string;
  resource_id: string;
  payload: Record<string, unknown>;
  trace_id?: string;
  occurred_at: string;
};

export function toAuditEventDto(event: AuditEvent): AuditEventDto {
  return {
    audit_event_id: event.auditEventId,
    actor: event.actor,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId,
    payload: event.payload,
    trace_id: event.traceId,
    occurred_at: event.occurredAt,
  };
}
