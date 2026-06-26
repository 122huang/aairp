import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { ContextBuilderService, ReviewPipelineService } from '@aairp/application';
import { AdvertisementNotFoundError, DEMO_KNOWLEDGE_VERSIONS } from '@aairp/application';
import { registerOpenRiskDiscoveryController } from './open-risk-discovery.controller.js';
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
    text: 'Daily vitamins for general wellness.',
    imageUrls: [],
  },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-06-26T10:05:00.000Z',
};

const openRiskPipelineResult = {
  ruleResult: {
    hasBlocker: false,
    findings: [],
    reviewId: 'rev_test',
    rulePackVersion: 'demo',
    evaluatedAt: '',
  },
  playbookResult: {
    findings: [],
    reviewId: 'rev_test',
    playbookPackVersion: 'demo',
    evaluatedAt: '',
  },
  openRiskResult: {
    reviewId: 'rev_test',
    promptPackVersion: 'demo-open-risk-1.0.0',
    skipped: false,
    evaluatedAt: '2026-06-26T10:08:00.000Z',
    findings: [
      {
        module: 'LLM',
        findingId: 'lf_test',
        severity: 'MEDIUM',
        decision: 'WARN',
        refType: 'LLM_RISK',
        refId: 'combined-misleading-claim',
        refVersionId: 'demo-open-risk-1.0.0-combined-misleading-claim-v1',
        summary: 'Semantic combination risk',
        confidence: 0.72,
      },
    ],
  },
  timings: {
    ruleMs: 1,
    playbookMs: 1,
    openRiskMs: 1,
    totalMs: 3,
  },
};

function createDeps(): {
  contextBuilderService: ContextBuilderService;
  reviewPipelineService: ReviewPipelineService;
} {
  return {
    contextBuilderService: {
      buildFromAdvertisementId: vi.fn().mockResolvedValue(sampleContext),
      buildFromAdvertisement: vi.fn(),
    } as unknown as ContextBuilderService,
    reviewPipelineService: {
      runThroughOpenRisk: vi.fn().mockResolvedValue(openRiskPipelineResult),
    } as unknown as ReviewPipelineService,
  };
}

async function buildTestApp(deps: ReturnType<typeof createDeps>) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerOpenRiskDiscoveryController(app, deps);
  await app.ready();
  return app;
}

describe('OpenRiskDiscoveryController', () => {
  let deps: ReturnType<typeof createDeps>;

  beforeEach(() => {
    deps = createDeps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /demo/open-risk-discovery returns 200 with LLM findings', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/open-risk-discovery',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'ad_test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      review_id: 'rev_test',
      skipped: false,
      findings: [{ module: 'LLM', ref_id: 'combined-misleading-claim' }],
    });
    expect(deps.reviewPipelineService.runThroughOpenRisk).toHaveBeenCalled();
    await app.close();
  });

  it('POST /demo/open-risk-discovery returns skipped result when blocker exists', async () => {
    vi.mocked(deps.reviewPipelineService.runThroughOpenRisk).mockResolvedValue({
      ...openRiskPipelineResult,
      openRiskResult: {
        ...openRiskPipelineResult.openRiskResult,
        skipped: true,
        skipReason: 'HAS_BLOCKER',
        findings: [],
      },
    });
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/open-risk-discovery',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'ad_test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      skipped: true,
      skip_reason: 'HAS_BLOCKER',
      findings: [],
    });
    await app.close();
  });

  it('POST /demo/open-risk-discovery returns 400 when advertisement_id is missing', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/open-risk-discovery',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /demo/open-risk-discovery returns 400 when advertisement is not found', async () => {
    vi.mocked(deps.contextBuilderService.buildFromAdvertisementId).mockRejectedValue(
      new AdvertisementNotFoundError('missing-ad'),
    );
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/open-risk-discovery',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'missing-ad' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe('OpenRiskDiscoveryController integration', () => {
  it('upload then discover open risks end-to-end without blocker', async () => {
    const {
      AdvertisementUploadService,
      ContextBuilderService,
      DecisionEngineService,
      OpenRiskDiscoveryService,
      PlaybookEngineService,
      ReviewPipelineService,
      ReviewReportService,
      RuleEngineService,
    } = await import('@aairp/application');
    const { InMemoryAdvertisementRepository } = await import('@aairp/infrastructure');
    const { registerAdvertisementUploadController } = await import(
      './advertisement-upload.controller.js'
    );

    const repository = new InMemoryAdvertisementRepository();
    const uploadService = new AdvertisementUploadService(repository, {
      createId: () => '99999999-9999-9999-9999-999999999999',
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    });
    const contextService = new ContextBuilderService(repository, {
      createReviewId: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      now: () => new Date('2026-06-26T10:05:00.000Z'),
    });
    const reviewPipelineService = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService({
        now: () => new Date('2026-06-26T10:08:00.000Z'),
      }),
      decisionEngineService: new DecisionEngineService(),
      reviewReportService: new ReviewReportService(),
    });

    const app = Fastify();
    registerTraceMiddleware(app);
    registerErrorHandler(app);
    await registerAdvertisementUploadController(app, {
      advertisementUploadService: uploadService,
    });
    await registerOpenRiskDiscoveryController(app, {
      contextBuilderService: contextService,
      reviewPipelineService,
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
        content: { text: 'Daily vitamins for general wellness.' },
      },
    });

    const uploadBody = uploadResponse.json();
    const openRiskResponse = await app.inject({
      method: 'POST',
      url: '/demo/open-risk-discovery',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: uploadBody.advertisement_id },
    });

    expect(openRiskResponse.statusCode).toBe(200);
    expect(openRiskResponse.json()).toMatchObject({
      review_id: 'rev_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      skipped: false,
      findings: [],
    });
    await app.close();
  });

  it('upload sample ad with blocker skips open risk discovery', async () => {
    const {
      AdvertisementUploadService,
      ContextBuilderService,
      DecisionEngineService,
      OpenRiskDiscoveryService,
      PlaybookEngineService,
      ReviewPipelineService,
      ReviewReportService,
      RuleEngineService,
    } = await import('@aairp/application');
    const { InMemoryAdvertisementRepository } = await import('@aairp/infrastructure');
    const { registerAdvertisementUploadController } = await import(
      './advertisement-upload.controller.js'
    );

    const repository = new InMemoryAdvertisementRepository();
    const uploadService = new AdvertisementUploadService(repository, {
      createId: () => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    });
    const contextService = new ContextBuilderService(repository, {
      createReviewId: () => 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      now: () => new Date('2026-06-26T10:05:00.000Z'),
    });
    const reviewPipelineService = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService(),
      decisionEngineService: new DecisionEngineService(),
      reviewReportService: new ReviewReportService(),
    });

    const app = Fastify();
    registerTraceMiddleware(app);
    registerErrorHandler(app);
    await registerAdvertisementUploadController(app, {
      advertisementUploadService: uploadService,
    });
    await registerOpenRiskDiscoveryController(app, {
      contextBuilderService: contextService,
      reviewPipelineService,
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
    const openRiskResponse = await app.inject({
      method: 'POST',
      url: '/demo/open-risk-discovery',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: uploadBody.advertisement_id },
    });

    expect(openRiskResponse.statusCode).toBe(200);
    expect(openRiskResponse.json()).toMatchObject({
      skipped: true,
      skip_reason: 'HAS_BLOCKER',
      findings: [],
    });
    await app.close();
  });
});
