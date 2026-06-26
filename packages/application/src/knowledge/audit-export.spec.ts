import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '@aairp/shared-kernel';
import { formatAuditEventsCsv } from './audit-export.js';

describe('formatAuditEventsCsv', () => {
  it('renders header and escaped payload', () => {
    const events: AuditEvent[] = [
      {
        auditEventId: 'ae-1',
        actor: 'legal@demo',
        action: 'PUBLISH',
        resourceType: 'rule_version',
        resourceId: 'rv-1',
        payload: { note: 'hello, world' },
        traceId: 'trace-1',
        occurredAt: '2026-06-26T10:00:00.000Z',
      },
    ];

    const csv = formatAuditEventsCsv(events);
    expect(csv).toContain('audit_event_id,actor,action');
    expect(csv).toContain('ae-1,legal@demo,PUBLISH');
    expect(csv).toContain('""note"":""hello, world""');
  });
});
