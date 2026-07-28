import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewContext, VisionDiscoveryResult } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { ContextualRewriteService } from './contextual-rewrite.service.js';
import { DecisionEngineService } from './decision-engine.service.js';
import { OpenRiskDiscoveryService } from './open-risk-discovery.service.js';
import { PlaybookEngineService } from './playbook-engine.service.js';
import {
  mergeRuleEvaluationResults,
  ReviewPipelineService,
  withVisionTextContext,
} from './review-pipeline.service.js';
import { ReviewReportService } from './review-report.service.js';
import { RuleEngineService } from './rule-engine.service.js';
import type { VisionComplianceService } from './vision-compliance.service.js';

const warnContext: ReviewContext = {
  reviewId: 'rev_pipeline_rewrite',
  advertisementId: 'ad_pipeline_rewrite',
  contentHash: 'hash_pipeline',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'SHOPEE',
    categoryId: 'sa.air_fryer',
  },
  normalizedContent: {
    text: '少油烹饪，让您吃得更轻盈无负担。',
    imageUrls: [],
  },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-06-29T00:00:00.000Z',
};

describe('ReviewPipelineService contextual rewrites (6B-1f)', () => {
  const previousMode = process.env.AAIRP_REWRITE_MODE;

  beforeEach(() => {
    process.env.AAIRP_REWRITE_MODE = 'stub';
  });

  afterEach(() => {
    if (previousMode === undefined) {
      delete process.env.AAIRP_REWRITE_MODE;
    } else {
      process.env.AAIRP_REWRITE_MODE = previousMode;
    }
  });

  function createPipeline() {
    return new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService(),
      decisionEngineService: new DecisionEngineService(),
      reviewReportService: new ReviewReportService(),
      contextualRewriteService: new ContextualRewriteService(),
    });
  }

  it('batch-generates rewrite suggestions after report when final decision is REVIEW', async () => {
    const pipeline = createPipeline();
    const result = await pipeline.runThroughReport(warnContext);

    expect(result.decision.finalDecision).toBe('REVIEW');
    expect(result.contextualRewrites?.mode).toBe('stub');
    expect(result.contextualRewrites?.results.length).toBeGreaterThan(0);
    expect(
      result.contextualRewrites?.results.some(
        (item) => !item.skipped && item.suggestion?.riskType === 'health-implication',
      ),
    ).toBe(true);
    expect(result.timings.rewriteMs).toBeGreaterThanOrEqual(0);
    expect(result.report.reportHtml).toContain('修改建议');
    expect(result.report.reportHtml).toContain('remove-health-claim');
    expect(result.report.summary.findings.some((f) => f.rewriteSuggestions?.length)).toBe(true);
  });

  it('returns empty rewrite batch when mode is off', async () => {
    process.env.AAIRP_REWRITE_MODE = 'off';
    const pipeline = createPipeline();
    const result = await pipeline.runThroughReport(warnContext);

    expect(result.decision.finalDecision).toBe('REVIEW');
    expect(result.contextualRewrites?.mode).toBe('off');
    expect(result.contextualRewrites?.results).toEqual([]);
  });

  it('omits contextual rewrites when final decision is not WARN or REVIEW', async () => {
    const pipeline = createPipeline();
    const result = await pipeline.runThroughReport({
      ...warnContext,
      normalizedContent: {
        text: '360°热风循环，无需预热，即放即炸。',
        imageUrls: [],
      },
    });

    expect(result.decision.finalDecision).toBe('PASS');
    expect(result.contextualRewrites).toBeUndefined();
  });
});

describe('ReviewPipelineService vision text → rules re-eval', () => {
  const previousVisionMode = process.env.AAIRP_VISION_MODE;

  afterEach(() => {
    if (previousVisionMode === undefined) {
      delete process.env.AAIRP_VISION_MODE;
    } else {
      process.env.AAIRP_VISION_MODE = previousVisionMode;
    }
  });

  it('merges rule findings from Vision extracted_text when ad text is empty', async () => {
    process.env.AAIRP_VISION_MODE = 'live';
    const visionResult: VisionDiscoveryResult = {
      reviewId: 'rev_vision_rules',
      promptPackVersion: 'demo-vision-1.0.0',
      manifests: [],
      findings: [],
      hasBlocker: false,
      skipped: false,
      extractedText: [
        'Non-stick inner pot',
        'Tender beef stew in 30 minutes, not 3 hours',
        'Stew up to 2 kg beef',
      ],
      evaluatedAt: '2026-07-28T00:00:00.000Z',
    };

    const pipeline = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService({
        llmGateway: { complete: async () => ({ content: '{"findings":[]}' }) },
      }),
      decisionEngineService: new DecisionEngineService(),
      reviewReportService: new ReviewReportService(),
      visionComplianceService: {
        discover: vi.fn(async () => visionResult),
      } as unknown as VisionComplianceService,
    });

    const context: ReviewContext = {
      ...warnContext,
      reviewId: 'rev_vision_rules',
      dimensions: {
        ...warnContext.dimensions,
        categoryId: 'sa.other',
      },
      normalizedContent: {
        text: '',
        imageUrls: ['https://demo/pdp-long.jpg'],
      },
    };

    const stage = await pipeline.runThroughOpenRisk(context);
    expect(stage.ruleResult.findings.some((f) => f.refId === 'demo-apac-sa-performance-claim')).toBe(
      true,
    );
    expect(stage.ruleResult.findings.some((f) => f.refId === 'demo-apac-sa-capacity-claim')).toBe(
      true,
    );
  });

  it('forces REVIEW via readability gate when image extract is empty', async () => {
    process.env.AAIRP_VISION_MODE = 'live';
    const visionResult: VisionDiscoveryResult = {
      reviewId: 'rev_gate_empty',
      promptPackVersion: 'demo-vision-1.0.0',
      manifests: [],
      findings: [],
      hasBlocker: false,
      skipped: false,
      extractedText: [],
      imagePreprocess: [
        {
          sourceImageIndex: 0,
          upscaled: true,
          sharpened: true,
          sourceWidth: 42,
          sourceHeight: 1024,
          width: 700,
          height: 10000,
        },
      ],
      evaluatedAt: '2026-07-28T00:00:00.000Z',
    };

    const pipeline = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService({
        llmGateway: { complete: async () => ({ content: '{"findings":[]}' }) },
      }),
      decisionEngineService: new DecisionEngineService(),
      reviewReportService: new ReviewReportService(),
      visionComplianceService: {
        discover: vi.fn(async () => visionResult),
      } as unknown as VisionComplianceService,
    });

    const result = await pipeline.runThroughDecision({
      ...warnContext,
      reviewId: 'rev_gate_empty',
      normalizedContent: {
        text: '',
        imageUrls: ['https://demo/narrow.jpg'],
      },
    });

    expect(
      result.visionResult?.findings.some((f) => f.refId === 'insufficient-visible-text'),
    ).toBe(true);
    expect(result.decision.finalDecision).toBe('REVIEW');
    expect(result.decision.branchVerdicts?.image).toBe('REVIEW');
  });

  it('withVisionTextContext and mergeRuleEvaluationResults helpers', () => {
    const enriched = withVisionTextContext(warnContext, {
      reviewId: 'r',
      promptPackVersion: 'v',
      manifests: [],
      findings: [],
      hasBlocker: false,
      skipped: false,
      extractedText: ['Non-stick'],
      evaluatedAt: '2026-07-28T00:00:00.000Z',
    });
    expect(enriched.normalizedContent.visionText).toBe('Non-stick');

    const merged = mergeRuleEvaluationResults(
      {
        reviewId: 'r',
        findings: [
          {
            module: 'RULE',
            findingId: 'a',
            severity: 'LOW',
            decision: 'INFO',
            refType: 'RULE',
            refId: 'keep',
            refVersionId: 'keep-v1',
            summary: 'keep',
            confidence: 1,
          },
        ],
        hasBlocker: false,
        evaluatedAt: 't',
        rulePackVersion: 'v',
      },
      {
        reviewId: 'r',
        findings: [
          {
            module: 'RULE',
            findingId: 'b',
            severity: 'HIGH',
            decision: 'WARN',
            refType: 'RULE',
            refId: 'demo-apac-sa-performance-claim',
            refVersionId: 'v',
            summary: 'perf',
            confidence: 1,
          },
          {
            module: 'RULE',
            findingId: 'c',
            severity: 'LOW',
            decision: 'INFO',
            refType: 'RULE',
            refId: 'keep',
            refVersionId: 'keep-v1',
            summary: 'dup',
            confidence: 1,
          },
        ],
        hasBlocker: false,
        evaluatedAt: 't',
        rulePackVersion: 'v',
      },
    );
    expect(merged.findings).toHaveLength(2);
    expect(merged.findings.map((f) => f.refId)).toEqual([
      'keep',
      'demo-apac-sa-performance-claim',
    ]);
  });
});
