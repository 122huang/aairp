import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { RuleAdminService } from '@aairp/application';
import { registerRuleController } from './rule.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createServiceMock(): RuleAdminService {
  return {
    listPacks: vi.fn().mockResolvedValue({
      items: [
        {
          rulePackId: 'pack-1',
          packKey: 'demo-rules',
          name: 'Demo Rules',
          createdAt: '2026-06-26T10:00:00.000Z',
          updatedAt: '2026-06-26T10:00:00.000Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    }),
    createPack: vi.fn(),
    getPack: vi.fn(),
    listRules: vi.fn(),
    createRule: vi.fn(),
    getRule: vi.fn(),
    listVersions: vi.fn(),
    getVersion: vi.fn(),
    createVersion: vi.fn(),
    updateVersion: vi.fn(),
    publishVersion: vi.fn(),
    rollbackVersion: vi.fn(),
    listRegulationVersionIds: vi.fn(),
    setRegulationVersionLinks: vi.fn(),
    exportPack: vi.fn(),
  } as unknown as RuleAdminService;
}

async function buildTestApp(service: RuleAdminService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerRuleController(app, { ruleAdminService: service });
  await app.ready();
  return app;
}

describe('RuleController', () => {
  it('GET /rule-packs returns paginated list', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: '/rule-packs',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      items: [{ pack_key: 'demo-rules' }],
    });
    await app.close();
  });
});
