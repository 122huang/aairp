import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { ICaseStore } from '@aairp/shared-kernel';
import type { IAdvertisementRepository, NormalizedAdvertisement } from '@aairp/domain';
import { AdvertisementUploadService } from '../advertisement/advertisement-upload.service.js';
import { CaseBuilderService } from './case-builder.service.js';
import { CaseRecorderService } from './case-recorder.service.js';
import { ContextBuilderService } from '../review/context-builder.service.js';
import { DecisionEngineService } from '../review/decision-engine.service.js';
import { OpenRiskDiscoveryService } from '../review/open-risk-discovery.service.js';
import { PlaybookEngineService } from '../review/playbook-engine.service.js';
import { ReviewHappyPathService } from '../review/review-happy-path.service.js';
import { ReviewPipelineService } from '../review/review-pipeline.service.js';
import { ReviewReportService } from '../review/review-report.service.js';
import { RuleEngineService } from '../review/rule-engine.service.js';

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

describe('CaseBuilderService + CaseRecorderService', () => {
  it('builds case with 20 core fields from happy path result', async () => {
    const service = createHappyPathService();
    const payload = JSON.parse(readFileSync(sampleAdPath, 'utf8'));
    const run = await service.run(payload);

    expect(run.caseSnapshot.context.reviewId).toBe(run.reviewId);
    expect(run.caseSnapshot.ruleResult.hasBlocker).toBe(true);

    const builder = new CaseBuilderService({
      pipelineVersion: 'test',
      createCaseId: () => '18181818-1818-1818-1818-181818181818',
      now: () => new Date('2026-06-26T10:11:00.000Z'),
    });

    const caseRecord = builder.build(run);

    expect(caseRecord.case_id).toBe('case_18181818-1818-1818-1818-181818181818');
    expect(caseRecord.schema_version).toBe('1.0.0');
    expect(caseRecord.case_version).toBe(1);
    expect(caseRecord.dimensions.country_id).toBe('SG');
    expect(caseRecord.advertisement.content.text).toContain('cure');
    expect(caseRecord.matched_rules.length).toBeGreaterThan(0);
    expect(caseRecord.decision.ai_decision).toBe('REJECT');
    expect(caseRecord.decision.final_decision).toBe('REJECT');
    expect(caseRecord.llm_analysis.skipped).toBe(true);
    expect(caseRecord.reference_regulations.length).toBeGreaterThan(0);
    expect(caseRecord.created_at).toBeTruthy();
  });

  it('recordSafely does not throw when store fails', async () => {
    const service = createHappyPathService();
    const run = await service.run(JSON.parse(readFileSync(sampleAdPath, 'utf8')));

    const failingStore: ICaseStore = {
      save: async () => {
        throw new Error('disk full');
      },
      findByCaseId: async () => null,
      findByReviewId: async () => null,
      search: async () => [],
      listManifest: async () => [],
      exportAll: async () => [],
    };

    const recorder = new CaseRecorderService({
      caseBuilderService: new CaseBuilderService(),
      caseStore: failingStore,
      enabled: true,
      log: vi.fn(),
    });

    expect(() => recorder.recordSafely(run)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});
