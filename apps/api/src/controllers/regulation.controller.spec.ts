import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { RegulationAdminService } from '@aairp/application';
import { registerRegulationController } from './regulation.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createServiceMock(): RegulationAdminService {
  return {
    listRegulations: vi.fn().mockResolvedValue({
      items: [
        {
          regulationId: 'reg-1',
          regulationKey: 'sg-hpa-s7',
          jurisdiction: 'SG',
          createdAt: '2026-06-26T10:00:00.000Z',
          updatedAt: '2026-06-26T10:00:00.000Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    }),
    createRegulation: vi.fn(),
    getRegulation: vi.fn(),
    listVersions: vi.fn(),
    getVersion: vi.fn(),
    createVersion: vi.fn(),
    updateVersion: vi.fn(),
    publishVersion: vi.fn(),
    rollbackVersion: vi.fn(),
    exportBundle: vi.fn(),
  } as unknown as RegulationAdminService;
}

async function buildTestApp(service: RegulationAdminService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerRegulationController(app, { regulationAdminService: service });
  await app.ready();
  return app;
}

describe('RegulationController', () => {
  it('GET /regulations returns paginated list', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: '/regulations?jurisdiction=SG',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      items: [{ regulation_key: 'sg-hpa-s7', jurisdiction: 'SG' }],
    });
    await app.close();
  });
});
