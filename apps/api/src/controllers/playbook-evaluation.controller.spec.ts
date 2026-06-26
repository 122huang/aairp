import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { ContextBuilderService, PlaybookEngineService } from '@aairp/application';
import { AdvertisementNotFoundError, DEMO_KNOWLEDGE_VERSIONS } from '@aairp/application';
import { registerPlaybookEvaluationController } from './playbook-evaluation.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

const sampleContext = {
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
    text: 'Clinically proven to cure diabetes in 7 days. Buy now!',
    imageUrls: [],
  },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-06-26T10:05:00.000Z',
};

function createDeps(): {
  contextBuilderService: ContextBuilderService;
  playbookEngineService: PlaybookEngineService;
} {
  return {
    contextBuilderService: {
      buildFromAdvertisementId: vi.fn().mockResolvedValue(sampleContext),
      buildFromAdvertisement: vi.fn(),
    } as unknown as ContextBuilderService,
    playbookEngineService: {
      evaluate: vi.fn().mockReturnValue({
        reviewId: 'rev_test',
        playbookPackVersion: 'demo-playbook-1.0.0',
        evaluatedAt: '2026-06-26T10:07:00.000Z',
        findings: [
          {
            module: 'PLAYBOOK',
            findingId: 'pf_test',
            severity: 'MEDIUM',
            decision: 'WARN',
            refType: 'PLAYBOOK_PATTERN',
            refId: 'urgency-cta',
            refVersionId: 'demo-health-supplement-playbook-urgency-cta-v1',
            summary: 'Urgency CTAs should include offer validity or expiry date.',
            confidence: 0.85,
          },
        ],
      }),
    } as unknown as PlaybookEngineService,
  };
}

async function buildTestApp(deps: ReturnType<typeof createDeps>) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerPlaybookEvaluationController(app, deps);
  await app.ready();
  return app;
}

describe('PlaybookEvaluationController', () => {
  let deps: ReturnType<typeof createDeps>;

  beforeEach(() => {
    deps = createDeps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /demo/playbook-evaluation returns 200 with playbook findings', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/playbook-evaluation',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'ad_test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      review_id: 'rev_test',
      playbook_pack_version: 'demo-playbook-1.0.0',
      findings: [
        {
          module: 'PLAYBOOK',
          ref_id: 'urgency-cta',
          decision: 'WARN',
        },
      ],
    });
    expect(deps.contextBuilderService.buildFromAdvertisementId).toHaveBeenCalledWith('ad_test');
    expect(deps.playbookEngineService.evaluate).toHaveBeenCalledWith(sampleContext);
    await app.close();
  });

  it('POST /demo/playbook-evaluation returns 400 when advertisement_id is missing', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/playbook-evaluation',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /demo/playbook-evaluation returns 400 when advertisement is not found', async () => {
    vi.mocked(deps.contextBuilderService.buildFromAdvertisementId).mockRejectedValue(
      new AdvertisementNotFoundError('missing-ad'),
    );
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/playbook-evaluation',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'missing-ad' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      title: 'Bad Request',
      detail: 'advertisement not found: missing-ad',
    });
    await app.close();
  });
});

describe('PlaybookEvaluationController integration', () => {
  it('upload then evaluate playbook end-to-end', async () => {
    const {
      AdvertisementUploadService,
      ContextBuilderService,
      PlaybookEngineService,
    } = await import('@aairp/application');
    const { InMemoryAdvertisementRepository } = await import('@aairp/infrastructure');
    const { registerAdvertisementUploadController } = await import(
      './advertisement-upload.controller.js'
    );

    const repository = new InMemoryAdvertisementRepository();
    const uploadService = new AdvertisementUploadService(repository, {
      createId: () => '77777777-7777-7777-7777-777777777777',
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    });
    const contextService = new ContextBuilderService(repository, {
      createReviewId: () => '88888888-8888-8888-8888-888888888888',
      now: () => new Date('2026-06-26T10:05:00.000Z'),
    });
    const playbookEngineService = new PlaybookEngineService({
      now: () => new Date('2026-06-26T10:07:00.000Z'),
    });

    const app = Fastify();
    registerTraceMiddleware(app);
    registerErrorHandler(app);
    await registerAdvertisementUploadController(app, {
      advertisementUploadService: uploadService,
    });
    await registerPlaybookEvaluationController(app, {
      contextBuilderService: contextService,
      playbookEngineService,
    });
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
        content: {
          text: 'Clinically proven to cure diabetes in 7 days. Buy now!',
        },
      },
    });

    const uploadBody = uploadResponse.json();
    const playbookResponse = await app.inject({
      method: 'POST',
      url: '/demo/playbook-evaluation',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: uploadBody.advertisement_id },
    });

    expect(playbookResponse.statusCode).toBe(200);
    expect(playbookResponse.json()).toMatchObject({
      review_id: 'rev_88888888-8888-8888-8888-888888888888',
      findings: expect.arrayContaining([
        expect.objectContaining({
          ref_id: 'urgency-cta',
          decision: 'WARN',
        }),
      ]),
    });
    await app.close();
  });
});
