import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { AuditLogService } from '@aairp/application';
import { registerAuditController } from './audit.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createServiceMock(): AuditLogService {
  return {
    search: vi.fn().mockResolvedValue({
      items: [
        {
          auditEventId: 'ae-1',
          actor: 'legal@demo',
          action: 'PUBLISH',
          resourceType: 'rule_version',
          resourceId: 'rv-1',
          payload: {},
          traceId: 'trace-1',
          occurredAt: '2026-06-26T10:00:00.000Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    }),
    findById: vi.fn(),
    record: vi.fn(),
    exportCsv: vi.fn().mockResolvedValue('audit_event_id,actor\nae-1,legal@demo\n'),
  } as unknown as AuditLogService;
}

async function buildTestApp(service: AuditLogService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerAuditController(app, { auditLogService: service });
  await app.ready();
  return app;
}

describe('AuditController', () => {
  it('GET /audit-events returns paginated list', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: '/audit-events?resource_type=rule_version',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      items: [{ audit_event_id: 'ae-1', action: 'PUBLISH' }],
    });
    await app.close();
  });

  it('GET /audit-events/export returns csv attachment', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: '/audit-events/export?format=csv',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.body).toContain('ae-1,legal@demo');
    await app.close();
  });
});
