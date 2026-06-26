import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { PlaybookAdminService } from '@aairp/application';
import { registerPlaybookController } from './playbook.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createServiceMock(): PlaybookAdminService {
  return {
    listPacks: vi.fn().mockResolvedValue({
      items: [
        {
          playbookPackId: 'pack-1',
          packKey: 'demo-health-supplement-playbook',
          name: 'Demo Playbook',
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
    listVersions: vi.fn(),
    getVersion: vi.fn(),
    createVersion: vi.fn(),
    publishVersion: vi.fn(),
    rollbackVersion: vi.fn(),
    listPatterns: vi.fn(),
    getPattern: vi.fn(),
    createPattern: vi.fn(),
    updatePattern: vi.fn(),
    exportMarkdown: vi.fn(),
  } as unknown as PlaybookAdminService;
}

async function buildTestApp(service: PlaybookAdminService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerPlaybookController(app, { playbookAdminService: service });
  await app.ready();
  return app;
}

describe('PlaybookController', () => {
  it('GET /playbook-packs returns paginated list', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: '/playbook-packs',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      items: [{ pack_key: 'demo-health-supplement-playbook' }],
    });
    await app.close();
  });
});
