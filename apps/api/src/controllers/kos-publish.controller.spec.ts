import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { KosPublishService } from '@aairp/application';
import { KosPublishError } from '@aairp/shared-kernel';
import { registerKosPublishController } from './kos-publish.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createPublishServiceMock(): KosPublishService {
  return {
    publish: vi.fn().mockResolvedValue({
      objectType: 'rule',
      versionId: 'rv-2',
      parentId: 'rule-1',
      versionNumber: 2,
      status: 'PUBLISHED',
      publishedAt: '2026-06-26T10:00:00.000Z',
    }),
    rollback: vi.fn().mockResolvedValue({
      objectType: 'rule',
      versionId: 'rv-1',
      parentId: 'rule-1',
      versionNumber: 1,
      status: 'PUBLISHED',
      publishedAt: '2026-06-26T11:00:00.000Z',
    }),
  } as unknown as KosPublishService;
}

async function buildTestApp(service: KosPublishService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerKosPublishController(app, { kosPublishService: service });
  await app.ready();
  return app;
}

describe('KosPublishController', () => {
  it('POST /publish returns published version', async () => {
    const service = createPublishServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/publish',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-kos-actor': 'legal@demo',
      },
      payload: {
        object_type: 'rule',
        version_id: 'rv-2',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(service.publish).toHaveBeenCalledWith('rule', 'rv-2', {
      actor: 'legal@demo',
      traceId: expect.any(String),
    });
    expect(response.json()).toMatchObject({
      object_type: 'rule',
      version_id: 'rv-2',
      status: 'PUBLISHED',
    });
    await app.close();
  });

  it('POST /rollback returns rolled-back version', async () => {
    const service = createPublishServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/rollback',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: {
        object_type: 'rule',
        version_id: 'rv-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(service.rollback).toHaveBeenCalled();
    expect(response.json()).toMatchObject({
      version_id: 'rv-1',
      version_number: 1,
    });
    await app.close();
  });

  it('maps KosPublishError INVALID_STATE to 409', async () => {
    const service = createPublishServiceMock();
    vi.mocked(service.publish).mockRejectedValue(
      new KosPublishError('only DRAFT versions can be published', 'INVALID_STATE'),
    );
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/publish',
      headers: { 'content-type': 'application/json' },
      payload: { object_type: 'rule', version_id: 'rv-1' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.headers['content-type']).toContain('application/problem+json');
    await app.close();
  });

  it('returns 400 for invalid object_type', async () => {
    const app = await buildTestApp(createPublishServiceMock());

    const response = await app.inject({
      method: 'POST',
      url: '/publish',
      headers: { 'content-type': 'application/json' },
      payload: { object_type: 'agent', version_id: 'x' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
