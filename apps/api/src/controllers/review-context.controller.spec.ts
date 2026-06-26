import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { ContextBuilderService } from '@aairp/application';
import { AdvertisementNotFoundError, DEMO_KNOWLEDGE_VERSIONS } from '@aairp/application';
import { registerReviewContextController } from './review-context.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createServiceMock(): ContextBuilderService {
  return {
    buildFromAdvertisementId: vi.fn().mockResolvedValue({
      reviewId: 'rev_test',
      advertisementId: 'ad_test',
      contentHash: 'hash123',
      contentVersion: 1,
      dimensions: {
        tenantId: 'demo',
        countryId: 'SG',
        platformId: 'META',
        categoryId: 'health.supplement',
      },
      normalizedContent: {
        text: 'Buy now',
        imageUrls: [],
      },
      resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
      advertisementContext: {},
      tags: [],
      builtAt: '2026-06-26T10:05:00.000Z',
    }),
    buildFromAdvertisement: vi.fn(),
  } as unknown as ContextBuilderService;
}

async function buildTestApp(service: ContextBuilderService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerReviewContextController(app, { contextBuilderService: service });
  await app.ready();
  return app;
}

describe('ReviewContextController', () => {
  let service: ContextBuilderService;

  beforeEach(() => {
    service = createServiceMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /demo/review-context returns 200 with review context', async () => {
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/review-context',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'ad_test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      review_id: 'rev_test',
      advertisement_id: 'ad_test',
      resolved_knowledge_versions: {
        rule_pack_version: 'demo-rule-1.0.0',
        playbook_pack_version: 'demo-playbook-1.0.0',
      },
    });
    expect(service.buildFromAdvertisementId).toHaveBeenCalledWith('ad_test');
    await app.close();
  });

  it('POST /demo/review-context returns 400 when advertisement_id is missing', async () => {
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/review-context',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /demo/review-context returns 400 when advertisement is not found', async () => {
    vi.mocked(service.buildFromAdvertisementId).mockRejectedValue(
      new AdvertisementNotFoundError('missing-ad'),
    );
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/review-context',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'missing-ad' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({
      title: 'Bad Request',
      detail: 'advertisement not found: missing-ad',
    });
    await app.close();
  });
});

describe('ReviewContextController integration', () => {
  it('upload then build review context end-to-end', async () => {
    const { AdvertisementUploadService, ContextBuilderService } = await import(
      '@aairp/application'
    );
    const { InMemoryAdvertisementRepository } = await import('@aairp/infrastructure');
    const { registerAdvertisementUploadController } = await import(
      './advertisement-upload.controller.js'
    );

    const repository = new InMemoryAdvertisementRepository();
    const uploadService = new AdvertisementUploadService(repository, {
      createId: () => '33333333-3333-3333-3333-333333333333',
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    });
    const contextService = new ContextBuilderService(repository, {
      createReviewId: () => '44444444-4444-4444-4444-444444444444',
      now: () => new Date('2026-06-26T10:05:00.000Z'),
    });

    const app = Fastify();
    registerTraceMiddleware(app);
    registerErrorHandler(app);
    await registerAdvertisementUploadController(app, {
      advertisementUploadService: uploadService,
    });
    await registerReviewContextController(app, { contextBuilderService: contextService });
    await app.ready();

    const uploadResponse = await app.inject({
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
        content: { text: 'Context builder e2e' },
      },
    });

    const uploadBody = uploadResponse.json();
    const contextResponse = await app.inject({
      method: 'POST',
      url: '/demo/review-context',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: uploadBody.advertisement_id },
    });

    expect(contextResponse.statusCode).toBe(200);
    expect(contextResponse.json()).toMatchObject({
      review_id: 'rev_44444444-4444-4444-4444-444444444444',
      advertisement_id: 'ad_33333333-3333-3333-3333-333333333333',
      normalized_content: { text: 'Context builder e2e' },
    });
    await app.close();
  });
});
