import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { PromptAdminService } from '@aairp/application';
import { registerPromptController } from './prompt.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createServiceMock(): PromptAdminService {
  return {
    listPacks: vi.fn().mockResolvedValue({
      items: [
        {
          promptPackId: 'pack-1',
          packKey: 'demo-open-risk',
          name: 'Demo Prompt Pack',
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
    listTemplates: vi.fn(),
    createTemplate: vi.fn(),
    getTemplate: vi.fn(),
    listVersions: vi.fn(),
    getVersion: vi.fn(),
    createVersion: vi.fn(),
    updateVersion: vi.fn(),
    publishVersion: vi.fn(),
    rollbackVersion: vi.fn(),
    lintContent: vi.fn().mockReturnValue({
      valid: true,
      content_length: 10,
      line_count: 1,
      byte_length: 10,
      issues: [],
    }),
    getVersionContent: vi.fn(),
    exportPublishedContent: vi.fn(),
  } as unknown as PromptAdminService;
}

async function buildTestApp(service: PromptAdminService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerPromptController(app, { promptAdminService: service });
  await app.ready();
  return app;
}

describe('PromptController', () => {
  it('GET /prompt-packs returns paginated list', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: '/prompt-packs',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      items: [{ pack_key: 'demo-open-risk' }],
    });
    await app.close();
  });

  it('POST /prompt-templates/lint returns lint result', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/prompt-templates/lint',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      payload: { content: 'hello' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ valid: true });
    await app.close();
  });
});
