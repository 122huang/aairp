import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { AdvertisementUploadService } from '@aairp/application';
import { AdvertisementUploadValidationError } from '@aairp/application';
import { registerAdvertisementUploadController } from './advertisement-upload.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createServiceMock(): AdvertisementUploadService {
  return {
    upload: vi.fn().mockResolvedValue({
      advertisementId: 'ad_test',
      tenantId: 'demo',
      countryId: 'SG',
      platformId: 'META',
      categoryId: 'health.supplement',
      content: { text: 'Buy now', images: [] },
      context: {},
      tags: [],
      contentHash: 'abc123',
      contentVersion: 1,
      parentAdvertisementId: null,
      status: 'PENDING_REVIEW',
      uploadedAt: '2026-06-26T10:00:00.000Z',
    }),
  } as unknown as AdvertisementUploadService;
}

async function buildTestApp(service: AdvertisementUploadService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerAdvertisementUploadController(app, { advertisementUploadService: service });
  await app.ready();
  return app;
}

describe('AdvertisementUploadController', () => {
  let service: AdvertisementUploadService;

  beforeEach(() => {
    service = createServiceMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /demo/advertisements returns 201 with snake_case body', async () => {
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/advertisements',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: {
        country_id: 'SG',
        platform_id: 'META',
        category_id: 'health.supplement',
        content: { text: 'Buy now' },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      advertisement_id: 'ad_test',
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      status: 'PENDING_REVIEW',
      content_version: 1,
    });
    expect(service.upload).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('POST /demo/advertisements returns 400 for validation errors', async () => {
    vi.mocked(service.upload).mockRejectedValue(
      new AdvertisementUploadValidationError('country_id: country_id is required', [
        { field: 'country_id', message: 'country_id is required' },
      ]),
    );
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/advertisements',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({
      title: 'Bad Request',
      errors: [{ field: 'country_id', message: 'country_id is required' }],
    });
    await app.close();
  });
});

describe('AdvertisementUploadController integration', () => {
  it('POST /demo/advertisements persists via in-memory repository', async () => {
    const { AdvertisementUploadService } = await import('@aairp/application');
    const { InMemoryAdvertisementRepository } = await import('@aairp/infrastructure');

    const repository = new InMemoryAdvertisementRepository();
    const service = new AdvertisementUploadService(repository, {
      createId: () => '22222222-2222-2222-2222-222222222222',
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    });

    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/advertisements',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: {
        country_id: 'SG',
        platform_id: 'META',
        category_id: 'health.supplement',
        content: { text: 'Integration upload' },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.advertisement_id).toBe('ad_22222222-2222-2222-2222-222222222222');
    expect(await repository.findById(body.advertisement_id)).not.toBeNull();
    await app.close();
  });
});
