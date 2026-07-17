import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { ICaseStore } from '@aairp/shared-kernel';
import type { IAdvertisementRepository, NormalizedAdvertisement } from '@aairp/domain';
import { AdvertisementUploadService } from '../advertisement/advertisement-upload.service.js';
import { CaseBuilderService, DEFAULT_CASE_REVIEWER_ID } from './case-builder.service.js';
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
    expect(caseRecord.thread_id).toBe(caseRecord.case_id);
    expect(caseRecord.parent_case_id).toBeUndefined();
    expect(caseRecord.reviewer_id).toBe(DEFAULT_CASE_REVIEWER_ID);
    expect(caseRecord.schema_version).toBe('1.0.0');
    expect(caseRecord.case_version).toBe(1);
    expect(caseRecord.dimensions.country_id).toBe('SG');
    expect(caseRecord.dimensions.legal_reviewed_market).toBe(true);
    expect(caseRecord.advertisement.content.text).toContain('cure');
    expect(caseRecord.matched_rules.length).toBeGreaterThan(0);
    expect(caseRecord.decision.ai_decision).toBe('REJECT');
    expect(caseRecord.decision.final_decision).toBe('REJECT');
    expect(caseRecord.llm_analysis.skipped).toBe(true);
    expect(caseRecord.reference_regulations.length).toBeGreaterThan(0);
    expect(caseRecord.created_at).toBeTruthy();
  });

  it('inherits thread_id and sets parent_case_id on resubmit', () => {
    const builder = new CaseBuilderService({
      createCaseId: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      now: () => new Date('2026-06-26T10:11:00.000Z'),
    });

    const caseRecord = builder.build({
      reviewId: 'rev_child',
      advertisementId: 'ad_child',
      decision: {
        finalDecision: 'WARN',
        confidence: 0.8,
        rationale: 'test',
        findingCounts: { blocker: 0, high: 0, medium: 1, low: 0, info: 0 },
        decidedAt: '2026-06-26T10:09:00.000Z',
      },
      report: {
        summary: { openRiskSkipped: false },
      } as never,
      caseSnapshot: {
        context: {
          reviewId: 'rev_child',
          contentHash: 'hash',
          contentVersion: 1,
          dimensions: {
            tenantId: 'demo',
            countryId: 'SG',
            platformId: 'tiktok',
            categoryId: 'health.supplement',
          },
          normalizedContent: {
            text: 'Revised copy for up to 8-10 people.',
            imageUrls: [],
          },
          resolvedKnowledgeVersions: {},
          advertisementContext: {},
          tags: [],
          builtAt: '2026-06-26T10:05:00.000Z',
        },
        ruleResult: { findings: [], hasBlocker: false, evaluatedAt: '2026-06-26T10:06:00.000Z' },
        playbookResult: { findings: [], evaluatedAt: '2026-06-26T10:07:00.000Z' },
        openRiskResult: {
          promptPackVersion: 'demo-open-risk-1.5.4',
          skipped: true,
          skipReason: 'HAS_BLOCKER',
          findings: [],
          evaluatedAt: '2026-06-26T10:08:00.000Z',
        },
      } as never,
      threadLink: {
        parent_case_id: 'case_parent_root',
        inherited_thread_id: 'case_parent_root',
        reviewer_id: DEFAULT_CASE_REVIEWER_ID,
      },
    } as never);

    expect(caseRecord.case_id).toBe('case_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(caseRecord.thread_id).toBe('case_parent_root');
    expect(caseRecord.parent_case_id).toBe('case_parent_root');
    expect(caseRecord.reviewer_id).toBe(DEFAULT_CASE_REVIEWER_ID);
  });

  it('record() resolves parent thread when parent_case_id is provided', async () => {
    const service = createHappyPathService();
    const run = await service.run(JSON.parse(readFileSync(sampleAdPath, 'utf8')));

    const parent: Awaited<ReturnType<ICaseStore['findByCaseId']>> = {
      case_id: 'case_parent_root',
      thread_id: 'case_parent_root',
      reviewer_id: DEFAULT_CASE_REVIEWER_ID,
    } as never;

    const saved: Array<{ case_id: string; thread_id?: string; parent_case_id?: string }> = [];
    const store: ICaseStore = {
      save: async (record) => {
        saved.push({
          case_id: record.case_id,
          thread_id: record.thread_id,
          parent_case_id: record.parent_case_id,
        });
        return { case_id: record.case_id, path: 'mem', created: true };
      },
      findByCaseId: async (caseId) => (caseId === parent!.case_id ? parent : null),
      findByReviewId: async () => null,
      search: async () => [],
      listManifest: async () => [],
      exportAll: async () => [],
    };

    const recorder = new CaseRecorderService({
      caseBuilderService: new CaseBuilderService({
        createCaseId: () => 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        now: () => new Date('2026-06-26T10:11:00.000Z'),
      }),
      caseStore: store,
      enabled: true,
    });

    const recorded = await recorder.record(run, { parent_case_id: 'case_parent_root' });
    expect(recorded?.thread_id).toBe('case_parent_root');
    expect(recorded?.parent_case_id).toBe('case_parent_root');
    expect(recorded?.reviewer_id).toBe(DEFAULT_CASE_REVIEWER_ID);
    expect(saved[0]).toMatchObject({
      thread_id: 'case_parent_root',
      parent_case_id: 'case_parent_root',
    });
  });

  it('maps Open Risk evidenceSpans into CaseRecord evidence TEXT_SPAN', () => {
    const builder = new CaseBuilderService({
      createCaseId: () => '19191919-1919-1919-1919-191919191919',
      now: () => new Date('2026-06-26T10:11:00.000Z'),
    });

    const caseRecord = builder.build({
      reviewId: 'rev_test',
      advertisementId: 'ad_test',
      decision: {
        finalDecision: 'WARN',
        confidence: 0.8,
        rationale: 'test',
        findingCounts: { blocker: 0, high: 0, medium: 1, low: 0, info: 0 },
        decidedAt: '2026-06-26T10:09:00.000Z',
      },
      report: {
        summary: { openRiskSkipped: false },
      } as never,
      caseSnapshot: {
        context: {
          reviewId: 'rev_test',
          contentHash: 'hash',
          contentVersion: 1,
          dimensions: {
            tenantId: 'demo',
            countryId: 'SG',
            platformId: 'tiktok',
            categoryId: 'health.supplement',
          },
          normalizedContent: {
            text: 'This blender is clinically proven to cure fatigue.',
            imageUrls: [],
          },
          resolvedKnowledgeVersions: {},
          advertisementContext: {},
          tags: [],
          builtAt: '2026-06-26T10:05:00.000Z',
        },
        ruleResult: { findings: [], hasBlocker: false, evaluatedAt: '2026-06-26T10:06:00.000Z' },
        playbookResult: { findings: [], evaluatedAt: '2026-06-26T10:07:00.000Z' },
        openRiskResult: {
          promptPackVersion: 'demo-open-risk-1.5.4',
          model: 'deepseek-chat',
          skipped: false,
          findings: [
            {
              module: 'LLM',
              refId: 'medical-claim',
              refVersionId: 'open-risk',
              severity: 'HIGH',
              decision: 'WARN',
              summary: 'Implies medical cure without substantiation.',
              evaluationDetail: {
                evidenceSpans: [
                  {
                    field: 'text',
                    start: 20,
                    end: 48,
                    text: 'clinically proven to cure',
                  },
                ],
              },
            },
          ],
          evaluatedAt: '2026-06-26T10:08:00.000Z',
        },
      } as never,
    } as never);

    expect(caseRecord.llm_analysis.llm_model).toBe('deepseek-chat');
    const spanEvidence = caseRecord.evidence.filter((e) => e.evidence_type === 'TEXT_SPAN');
    expect(spanEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_module: 'LLM',
          source_ref_id: 'medical-claim',
          evidence_type: 'TEXT_SPAN',
          field: 'text',
          start: 20,
          end: 48,
          text: 'clinically proven to cure',
        }),
      ]),
    );
    expect(spanEvidence.some((e) => e.evidence_type === 'SUMMARY')).toBe(false);
  });

  it('persists Vision findings and model into CaseRecord vision_analysis', () => {
    const builder = new CaseBuilderService({
      createCaseId: () => '20202020-2020-2020-2020-202020202020',
      now: () => new Date('2026-06-26T10:11:00.000Z'),
    });

    const caseRecord = builder.build({
      reviewId: 'rev_vision',
      advertisementId: 'ad_vision',
      decision: {
        finalDecision: 'WARN',
        confidence: 0.7,
        rationale: 'vision finding',
        findingCounts: { blocker: 0, high: 0, medium: 1, low: 0, info: 0, vision: 1 },
        decidedAt: '2026-06-26T10:09:00.000Z',
      },
      report: {
        summary: { openRiskSkipped: false },
      } as never,
      caseSnapshot: {
        context: {
          reviewId: 'rev_vision',
          contentHash: 'hash_v',
          contentVersion: 1,
          dimensions: {
            tenantId: 'demo',
            countryId: 'CN',
            platformId: 'META',
            categoryId: 'sa.air_fryer',
          },
          normalizedContent: {
            text: '空气炸锅',
            imageUrls: ['https://example.com/panel.png'],
          },
          resolvedKnowledgeVersions: {},
          advertisementContext: {},
          tags: [],
          builtAt: '2026-06-26T10:05:00.000Z',
        },
        ruleResult: { findings: [], hasBlocker: false, evaluatedAt: '2026-06-26T10:06:00.000Z' },
        playbookResult: { findings: [], evaluatedAt: '2026-06-26T10:07:00.000Z' },
        openRiskResult: {
          promptPackVersion: 'demo-open-risk-1.5.4',
          model: 'stub',
          skipped: false,
          findings: [],
          evaluatedAt: '2026-06-26T10:08:00.000Z',
        },
        visionResult: {
          promptPackVersion: 'demo-vision-1.0.0',
          model: 'stub:vision-scenario',
          manifests: [],
          findings: [
            {
              module: 'VISION',
              findingId: 'vf_1',
              refType: 'VISION_RISK',
              refId: 'localisation-error',
              refVersionId: 'demo-vision-1.0.0-localisation-error-v1',
              severity: 'HIGH',
              decision: 'WARN',
              summary: 'Unreplaced POS panel language',
              confidence: 0.9,
              evaluationDetail: {
                riskType: 'localisation-error',
                suggestedAction: 'WARN',
                evidenceSpans: [
                  {
                    field: 'image',
                    sliceIndex: 0,
                    regionDescription: 'top panel',
                    text: '未替换文案',
                  },
                ],
              },
            },
          ],
          hasBlocker: false,
          skipped: false,
          evaluatedAt: '2026-06-26T10:08:30.000Z',
        },
      } as never,
    } as never);

    expect(caseRecord.vision_analysis).toEqual(
      expect.objectContaining({
        prompt_pack_version: 'demo-vision-1.0.0',
        llm_model: 'stub:vision-scenario',
        skipped: false,
        findings: [
          expect.objectContaining({
            ref_id: 'localisation-error',
            decision: 'WARN',
            summary: 'Unreplaced POS panel language',
          }),
        ],
      }),
    );
    expect(caseRecord.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_module: 'VISION',
          source_ref_id: 'localisation-error',
          evidence_type: 'TEXT_SPAN',
          text: '未替换文案',
        }),
      ]),
    );
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
