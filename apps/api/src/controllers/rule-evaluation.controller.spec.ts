import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { ContextBuilderService, RuleEngineService } from '@aairp/application';
import { AdvertisementNotFoundError, DEMO_KNOWLEDGE_VERSIONS } from '@aairp/application';
import { registerRuleEvaluationController } from './rule-evaluation.controller.js';
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
  ruleEngineService: RuleEngineService;
} {
  return {
    contextBuilderService: {
      buildFromAdvertisementId: vi.fn().mockResolvedValue(sampleContext),
      buildFromAdvertisement: vi.fn(),
    } as unknown as ContextBuilderService,
    ruleEngineService: {
      evaluate: vi.fn().mockReturnValue({
        reviewId: 'rev_test',
        rulePackVersion: 'demo-rule-1.0.0',
        hasBlocker: true,
        evaluatedAt: '2026-06-26T10:06:00.000Z',
        findings: [
          {
            module: 'RULE',
            findingId: 'rf_test',
            severity: 'BLOCKER',
            decision: 'FAIL',
            refType: 'RULE',
            refId: 'demo-sg-health-forbidden-claim',
            refVersionId: 'demo-sg-health-forbidden-claim-v1',
            summary: 'Prohibited absolute health cure claims are not allowed',
            confidence: 1,
          },
        ],
      }),
    } as unknown as RuleEngineService,
  };
}

async function buildTestApp(deps: ReturnType<typeof createDeps>) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerRuleEvaluationController(app, deps);
  await app.ready();
  return app;
}

describe('RuleEvaluationController', () => {
  let deps: ReturnType<typeof createDeps>;

  beforeEach(() => {
    deps = createDeps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /demo/rule-evaluation returns 200 with rule findings', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/rule-evaluation',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'ad_test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      review_id: 'rev_test',
      rule_pack_version: 'demo-rule-1.0.0',
      has_blocker: true,
      findings: [
        {
          module: 'RULE',
          ref_id: 'demo-sg-health-forbidden-claim',
          severity: 'BLOCKER',
        },
      ],
    });
    expect(deps.contextBuilderService.buildFromAdvertisementId).toHaveBeenCalledWith('ad_test');
    expect(deps.ruleEngineService.evaluate).toHaveBeenCalledWith(sampleContext);
    await app.close();
  });

  it('POST /demo/rule-evaluation returns 400 when advertisement_id is missing', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/rule-evaluation',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /demo/rule-evaluation returns 400 when advertisement is not found', async () => {
    vi.mocked(deps.contextBuilderService.buildFromAdvertisementId).mockRejectedValue(
      new AdvertisementNotFoundError('missing-ad'),
    );
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/rule-evaluation',
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

describe('RuleEvaluationController integration', () => {
  it('upload then evaluate rules end-to-end', async () => {
    const {
      AdvertisementUploadService,
      ContextBuilderService,
      RuleEngineService,
    } = await import('@aairp/application');
    const { InMemoryAdvertisementRepository } = await import('@aairp/infrastructure');
    const { registerAdvertisementUploadController } = await import(
      './advertisement-upload.controller.js'
    );

    const repository = new InMemoryAdvertisementRepository();
    const uploadService = new AdvertisementUploadService(repository, {
      createId: () => '55555555-5555-5555-5555-555555555555',
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    });
    const contextService = new ContextBuilderService(repository, {
      createReviewId: () => '66666666-6666-6666-6666-666666666666',
      now: () => new Date('2026-06-26T10:05:00.000Z'),
    });
    const ruleEngineService = new RuleEngineService({
      now: () => new Date('2026-06-26T10:06:00.000Z'),
    });

    const app = Fastify();
    registerTraceMiddleware(app);
    registerErrorHandler(app);
    await registerAdvertisementUploadController(app, {
      advertisementUploadService: uploadService,
    });
    await registerRuleEvaluationController(app, {
      contextBuilderService: contextService,
      ruleEngineService,
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
    const ruleResponse = await app.inject({
      method: 'POST',
      url: '/demo/rule-evaluation',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: uploadBody.advertisement_id },
    });

    expect(ruleResponse.statusCode).toBe(200);
    expect(ruleResponse.json()).toMatchObject({
      review_id: 'rev_66666666-6666-6666-6666-666666666666',
      has_blocker: true,
      findings: expect.arrayContaining([
        expect.objectContaining({
          ref_id: 'demo-sg-health-forbidden-claim',
          severity: 'BLOCKER',
        }),
      ]),
    });
    await app.close();
  });
});
