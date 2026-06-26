import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { IAdvertisementRepository, NormalizedAdvertisement } from '@aairp/domain';
import { AdvertisementUploadService } from '../advertisement/advertisement-upload.service.js';
import { ContextBuilderService } from './context-builder.service.js';
import { DecisionEngineService } from './decision-engine.service.js';
import { OpenRiskDiscoveryService } from './open-risk-discovery.service.js';
import { PlaybookEngineService } from './playbook-engine.service.js';
import { ReviewHappyPathService } from './review-happy-path.service.js';
import { ReviewPipelineService } from './review-pipeline.service.js';
import { ReviewReportService } from './review-report.service.js';
import { RuleEngineService } from './rule-engine.service.js';

const sampleAdPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/sample-ad-upload.json',
);

function createInMemoryRepository(): IAdvertisementRepository {
  const store = new Map<string, NormalizedAdvertisement>();
  return {
    save: async (advertisement) => {
      store.set(advertisement.advertisementId, advertisement);
      return advertisement;
    },
    findById: async (advertisementId) => store.get(advertisementId) ?? null,
  };
}

function createHappyPathService() {
  const repository = createInMemoryRepository();
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

  return new ReviewHappyPathService({
    advertisementUploadService: new AdvertisementUploadService(repository, {
      createId: () => '16161616-1616-1616-1616-161616161616',
      now: () => new Date('2026-06-26T10:00:00.000Z'),
    }),
    contextBuilderService: new ContextBuilderService(repository, {
      createReviewId: () => '17171717-1717-1717-1717-171717171717',
      now: () => new Date('2026-06-26T10:05:00.000Z'),
    }),
    reviewPipelineService,
  });
}

describe('ReviewHappyPathService', () => {
  it('runs upload through report for sample ad as REJECT', async () => {
    const service = createHappyPathService();
    const payload = JSON.parse(readFileSync(sampleAdPath, 'utf8'));

    const result = await service.run(payload);

    expect(result.reviewId).toBe('rev_17171717-1717-1717-1717-171717171717');
    expect(result.decision.finalDecision).toBe('REJECT');
    expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('runs upload through report for clean ad as PASS', async () => {
    const service = createHappyPathService();

    const result = await service.run({
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: { text: 'Daily vitamins for general wellness.' },
    });

    expect(result.decision.finalDecision).toBe('PASS');
    expect(result.report.summary.findings).toEqual([]);
  });
});
