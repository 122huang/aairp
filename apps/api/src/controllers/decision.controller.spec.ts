import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { ContextBuilderService, ReviewPipelineService } from '@aairp/application';
import { AdvertisementNotFoundError, DEMO_KNOWLEDGE_VERSIONS } from '@aairp/application';
import { registerDecisionController } from './decision.controller.js';
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

const passPipelineResult = {
  ruleResult: { hasBlocker: false, findings: [], reviewId: 'rev_test', rulePackVersion: 'demo', evaluatedAt: '' },
  playbookResult: { findings: [], reviewId: 'rev_test', playbookPackVersion: 'demo', evaluatedAt: '' },
  openRiskResult: {
    reviewId: 'rev_test',
    promptPackVersion: 'demo',
    skipped: false,
    evaluatedAt: '',
    findings: [],
  },
  decision: {
    reviewId: 'rev_test',
    finalDecision: 'PASS' as const,
    confidence: 0.95,
    rationale: 'No blocking or warning findings.',
    findingCounts: { rule: 0, playbook: 0, llm: 0 },
    decidedAt: '2026-06-26T10:09:00.000Z',
  },
  timings: {
    ruleMs: 1,
    playbookMs: 1,
    openRiskMs: 1,
    decisionMs: 1,
    reportMs: 0,
    totalMs: 4,
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
      runThroughDecision: vi.fn().mockResolvedValue(passPipelineResult),
    } as unknown as ReviewPipelineService,
  };
}

async function buildTestApp(deps: ReturnType<typeof createDeps>) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerDecisionController(app, deps);
  await app.ready();
  return app;
}

describe('DecisionController', () => {
  let deps: ReturnType<typeof createDeps>;

  beforeEach(() => {
    deps = createDeps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /demo/decision returns 200 with fused decision', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/decision',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'ad_test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      review_id: 'rev_test',
      final_decision: 'PASS',
      confidence: 0.95,
    });
    expect(deps.reviewPipelineService.runThroughDecision).toHaveBeenCalled();
    await app.close();
  });

  it('POST /demo/decision returns REJECT when blocker exists', async () => {
    vi.mocked(deps.reviewPipelineService.runThroughDecision).mockResolvedValue({
      ...passPipelineResult,
      decision: {
        ...passPipelineResult.decision,
        finalDecision: 'REJECT',
        confidence: 1,
        rationale: 'Rule BLOCKER finding requires rejection.',
      },
      openRiskResult: {
        ...passPipelineResult.openRiskResult,
        skipped: true,
        skipReason: 'HAS_BLOCKER' as const,
        findings: [],
      },
    });
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/decision',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'ad_test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      final_decision: 'REJECT',
      confidence: 1,
    });
    await app.close();
  });

  it('POST /demo/decision returns 400 when advertisement_id is missing', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/decision',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /demo/decision returns 400 when advertisement is not found', async () => {
    vi.mocked(deps.contextBuilderService.buildFromAdvertisementId).mockRejectedValue(
      new AdvertisementNotFoundError('missing-ad'),
    );
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/decision',
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

describe('DecisionController integration', () => {
  it('upload sample ad then fuse decision end-to-end as REJECT', async () => {
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
      createId: () => 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    });
    const contextService = new ContextBuilderService(repository, {
      createReviewId: () => 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      now: () => new Date('2026-06-26T10:05:00.000Z'),
    });
    const reviewPipelineService = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService(),
      decisionEngineService: new DecisionEngineService({
        now: () => new Date('2026-06-26T10:09:00.000Z'),
      }),
      reviewReportService: new ReviewReportService(),
    });

    const app = Fastify();
    registerTraceMiddleware(app);
    registerErrorHandler(app);
    await registerAdvertisementUploadController(app, {
      advertisementUploadService: uploadService,
    });
    await registerDecisionController(app, {
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
    const decisionResponse = await app.inject({
      method: 'POST',
      url: '/demo/decision',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: uploadBody.advertisement_id },
    });

    expect(decisionResponse.statusCode).toBe(200);
    expect(decisionResponse.json()).toMatchObject({
      review_id: 'rev_eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      final_decision: 'REJECT',
      confidence: 1,
    });
    await app.close();
  });
});
