import type { AuditEvent } from '@aairp/shared-kernel';

export const AUDIT_EXPORT_MAX_ROWS = 10_000;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatAuditEventsCsv(events: AuditEvent[]): string {
  const header = [
    'audit_event_id',
    'actor',
    'action',
    'resource_type',
    'resource_id',
    'trace_id',
    'occurred_at',
    'payload_json',
  ].join(',');

  const lines = events.map((event) =>
    [
      event.auditEventId,
      csvEscape(event.actor),
      csvEscape(event.action),
      csvEscape(event.resourceType),
      csvEscape(event.resourceId),
      csvEscape(event.traceId ?? ''),
      event.occurredAt,
      csvEscape(JSON.stringify(event.payload)),
    ].join(','),
  );

  return `${header}\n${lines.join('\n')}\n`;
}
