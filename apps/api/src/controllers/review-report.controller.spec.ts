import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { ContextBuilderService, ReviewPipelineService } from '@aairp/application';
import { AdvertisementNotFoundError, DEMO_KNOWLEDGE_VERSIONS } from '@aairp/application';
import { registerReviewReportController } from './review-report.controller.js';
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

const reportPipelineResult = {
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
  report: {
    reviewId: 'rev_test',
    advertisementId: 'ad_test',
    reportHtml: '<html>report</html>',
    summary: {
      finalDecision: 'PASS',
      confidence: 0.95,
      rationale: 'No blocking or warning findings.',
      findingCounts: { rule: 0, playbook: 0, llm: 0 },
      advertisement: {
        textPreview: 'Daily vitamins for general wellness.',
        countryId: 'SG',
        platformId: 'META',
        categoryId: 'health.supplement',
      },
      findings: [],
      openRiskSkipped: false,
    },
    generatedAt: '2026-06-26T10:10:00.000Z',
  },
  timings: {
    ruleMs: 1,
    playbookMs: 1,
    openRiskMs: 1,
    decisionMs: 1,
    reportMs: 1,
    totalMs: 5,
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
      runThroughReport: vi.fn().mockResolvedValue(reportPipelineResult),
    } as unknown as ReviewPipelineService,
  };
}

async function buildTestApp(deps: ReturnType<typeof createDeps>) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerReviewReportController(app, deps);
  await app.ready();
  return app;
}

describe('ReviewReportController', () => {
  let deps: ReturnType<typeof createDeps>;

  beforeEach(() => {
    deps = createDeps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /demo/review-report returns 200 with report_html and summary', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/review-report',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: 'ad_test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      review_id: 'rev_test',
      report_html: '<html>report</html>',
      summary: {
        final_decision: 'PASS',
        finding_counts: { rule: 0, playbook: 0, llm: 0 },
      },
    });
    expect(deps.reviewPipelineService.runThroughReport).toHaveBeenCalled();
    await app.close();
  });

  it('POST /demo/review-report returns 400 when advertisement_id is missing', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/review-report',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('POST /demo/review-report returns 400 when advertisement is not found', async () => {
    vi.mocked(deps.contextBuilderService.buildFromAdvertisementId).mockRejectedValue(
      new AdvertisementNotFoundError('missing-ad'),
    );
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/review-report',
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

describe('ReviewReportController integration', () => {
  it('upload sample ad then generate review report end-to-end as REJECT', async () => {
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
      createId: () => '12121212-1212-1212-1212-121212121212',
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    });
    const contextService = new ContextBuilderService(repository, {
      createReviewId: () => '13131313-1313-1313-1313-131313131313',
      now: () => new Date('2026-06-26T10:05:00.000Z'),
    });
    const reviewPipelineService = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService(),
      decisionEngineService: new DecisionEngineService({
        now: () => new Date('2026-06-26T10:09:00.000Z'),
      }),
      reviewReportService: new ReviewReportService({
        now: () => new Date('2026-06-26T10:10:00.000Z'),
      }),
    });

    const app = Fastify();
    registerTraceMiddleware(app);
    registerErrorHandler(app);
    await registerAdvertisementUploadController(app, {
      advertisementUploadService: uploadService,
    });
    await registerReviewReportController(app, {
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
    const reportResponse = await app.inject({
      method: 'POST',
      url: '/demo/review-report',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: uploadBody.advertisement_id },
    });

    expect(reportResponse.statusCode).toBe(200);
    const body = reportResponse.json();
    expect(body).toMatchObject({
      review_id: 'rev_13131313-1313-1313-1313-131313131313',
      summary: {
        final_decision: 'REJECT',
        open_risk_skipped: true,
        open_risk_skip_reason: 'HAS_BLOCKER',
      },
    });
    expect(body.report_html).toContain('<!DOCTYPE html>');
    expect(body.report_html).toContain('REJECT');
    expect(body.report_html).toContain('demo-sg-health-forbidden-claim');
    expect(body.summary.findings.length).toBeGreaterThan(0);
    await app.close();
  });

  it('upload clean ad then generate review report end-to-end as PASS', async () => {
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
      createId: () => '14141414-1414-1414-1414-141414141414',
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    });
    const contextService = new ContextBuilderService(repository, {
      createReviewId: () => '15151515-1515-1515-1515-151515151515',
      now: () => new Date('2026-06-26T10:05:00.000Z'),
    });
    const reviewPipelineService = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService({
        now: () => new Date('2026-06-26T10:08:00.000Z'),
      }),
      decisionEngineService: new DecisionEngineService({
        now: () => new Date('2026-06-26T10:09:00.000Z'),
      }),
      reviewReportService: new ReviewReportService({
        now: () => new Date('2026-06-26T10:10:00.000Z'),
      }),
    });

    const app = Fastify();
    registerTraceMiddleware(app);
    registerErrorHandler(app);
    await registerAdvertisementUploadController(app, {
      advertisementUploadService: uploadService,
    });
    await registerReviewReportController(app, {
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
        category_id: 'sa.vacuum_floor',
        content: { text: 'Compact cordless vacuum for everyday floor cleaning.' },
      },
    });

    const uploadBody = uploadResponse.json();
    const reportResponse = await app.inject({
      method: 'POST',
      url: '/demo/review-report',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { advertisement_id: uploadBody.advertisement_id },
    });

    expect(reportResponse.statusCode).toBe(200);
    const body = reportResponse.json();
    expect(body.summary.final_decision).toBe('PASS');
    expect(body.report_html).toContain('PASS');
    expect(body.report_html).toContain('No findings');
    await app.close();
  });
});
