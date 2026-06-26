import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { ReviewHappyPathService } from '@aairp/application';
import { AdvertisementUploadValidationError } from '@aairp/application';
import { registerDemoReviewController } from './demo-review.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

const sampleAdPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/sample-ad-upload.json',
);

function createDeps(): { reviewHappyPathService: ReviewHappyPathService } {
  return {
    reviewHappyPathService: {
      run: vi.fn().mockResolvedValue({
        reviewId: 'rev_test',
        advertisementId: 'ad_test',
        decision: {
          reviewId: 'rev_test',
          finalDecision: 'PASS',
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
      }),
    } as unknown as ReviewHappyPathService,
  };
}

async function buildTestApp(deps: ReturnType<typeof createDeps>) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerDemoReviewController(app, deps);
  await app.ready();
  return app;
}

describe('DemoReviewController', () => {
  let deps: ReturnType<typeof createDeps>;

  beforeEach(() => {
    deps = createDeps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /demo/review returns 200 with decision and report_html', async () => {
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/review',
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

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      review_id: 'rev_test',
      final_decision: 'PASS',
      report_html: '<html>report</html>',
    });
    expect(deps.reviewHappyPathService.run).toHaveBeenCalled();
    await app.close();
  });

  it('POST /demo/review returns 400 when upload validation fails', async () => {
    vi.mocked(deps.reviewHappyPathService.run).mockRejectedValue(
      new AdvertisementUploadValidationError('country_id: required', [
        { field: 'country_id', message: 'required' },
      ]),
    );
    const app = await buildTestApp(deps);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/review',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload: { content: { text: 'Missing dimensions' } },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe('DemoReviewController integration', () => {
  it('POST /demo/review runs full happy path for sample ad as REJECT', async () => {
    const {
      AdvertisementUploadService,
      ContextBuilderService,
      DecisionEngineService,
      OpenRiskDiscoveryService,
      PlaybookEngineService,
      ReviewHappyPathService,
      ReviewPipelineService,
      ReviewReportService,
      RuleEngineService,
    } = await import('@aairp/application');
    const { InMemoryAdvertisementRepository } = await import('@aairp/infrastructure');

    const repository = new InMemoryAdvertisementRepository();
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
    const reviewHappyPathService = new ReviewHappyPathService({
      advertisementUploadService: new AdvertisementUploadService(repository, {
        createId: () => '18181818-1818-1818-1818-181818181818',
        now: () => new Date('2026-06-26T10:00:00.000Z'),
      }),
      contextBuilderService: new ContextBuilderService(repository, {
        createReviewId: () => '19191919-1919-1919-1919-191919191919',
        now: () => new Date('2026-06-26T10:05:00.000Z'),
      }),
      reviewPipelineService,
    });

    const app = Fastify();
    registerTraceMiddleware(app);
    registerErrorHandler(app);
    await registerDemoReviewController(app, { reviewHappyPathService });
    await app.ready();

    const payload = JSON.parse(readFileSync(sampleAdPath, 'utf8'));
    const response = await app.inject({
      method: 'POST',
      url: '/demo/review',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      review_id: 'rev_19191919-1919-1919-1919-191919191919',
      advertisement_id: 'ad_18181818-1818-1818-1818-181818181818',
      final_decision: 'REJECT',
      confidence: 1,
    });
    expect(body.report_html).toContain('<!DOCTYPE html>');
    expect(body.report_html).toContain('REJECT');
    expect(body.summary.findings.length).toBeGreaterThan(0);
    await app.close();
  });

  it('POST /demo/review runs full happy path for clean ad as PASS', async () => {
    const {
      AdvertisementUploadService,
      ContextBuilderService,
      DecisionEngineService,
      OpenRiskDiscoveryService,
      PlaybookEngineService,
      ReviewHappyPathService,
      ReviewPipelineService,
      ReviewReportService,
      RuleEngineService,
    } = await import('@aairp/application');
    const { InMemoryAdvertisementRepository } = await import('@aairp/infrastructure');

    const repository = new InMemoryAdvertisementRepository();
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
    const reviewHappyPathService = new ReviewHappyPathService({
      advertisementUploadService: new AdvertisementUploadService(repository, {
        createId: () => '20202020-2020-2020-2020-202020202020',
        now: () => new Date('2026-06-26T10:00:00.000Z'),
      }),
      contextBuilderService: new ContextBuilderService(repository, {
        createReviewId: () => '21212121-2121-2121-2121-212121212121',
        now: () => new Date('2026-06-26T10:05:00.000Z'),
      }),
      reviewPipelineService,
    });

    const app = Fastify();
    registerTraceMiddleware(app);
    registerErrorHandler(app);
    await registerDemoReviewController(app, { reviewHappyPathService });
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/demo/review',
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

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.final_decision).toBe('PASS');
    expect(body.report_html).toContain('PASS');
    expect(body.summary.findings).toEqual([]);
    await app.close();
  });
});
