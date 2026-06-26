import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { CaseKosAdminService } from '@aairp/application';
import { registerCaseController } from './case.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createServiceMock(): CaseKosAdminService {
  return {
    search: vi.fn().mockResolvedValue({
      items: [
        {
          case_id: 'case_example_sg_health_reject',
          case_version: 1,
          path: 'kos://case_example_sg_health_reject/v1',
          review_id: 'rev_17171717-1717-1717-1717-171717171717',
          country_id: 'SG',
          category_id: 'health.supplement',
          platform_id: 'META',
          ai_decision: 'FAIL',
          final_decision: 'FAIL',
          lifecycle_status: 'GENERATED',
          content_hash: 'sha256:example',
          created_at: '2026-06-26T10:10:00.000Z',
          updated_at: '2026-06-26T10:10:00.000Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    }),
    getCase: vi.fn(),
    listVersions: vi.fn(),
    exportAllLatest: vi.fn(),
    confirmCase: vi.fn(),
    archiveCase: vi.fn(),
    rollbackCase: vi.fn(),
    saveVersion: vi.fn(),
  } as unknown as CaseKosAdminService;
}

async function buildTestApp(service: CaseKosAdminService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerCaseController(app, { caseKosAdminService: service });
  await app.ready();
  return app;
}

describe('CaseController', () => {
  it('GET /cases returns paginated list', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: '/cases',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      items: [{ case_id: 'case_example_sg_health_reject' }],
    });
    await app.close();
  });
});
