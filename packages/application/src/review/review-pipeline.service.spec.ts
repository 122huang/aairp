import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { ContextualRewriteService } from './contextual-rewrite.service.js';
import { DecisionEngineService } from './decision-engine.service.js';
import { OpenRiskDiscoveryService } from './open-risk-discovery.service.js';
import { PlaybookEngineService } from './playbook-engine.service.js';
import { ReviewPipelineService } from './review-pipeline.service.js';
import { ReviewReportService } from './review-report.service.js';
import { RuleEngineService } from './rule-engine.service.js';

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

  it('batch-generates rewrite suggestions after report when final decision is WARN', async () => {
    const pipeline = createPipeline();
    const result = await pipeline.runThroughReport(warnContext);

    expect(result.decision.finalDecision).toBe('WARN');
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

    expect(result.decision.finalDecision).toBe('WARN');
    expect(result.contextualRewrites?.mode).toBe('off');
    expect(result.contextualRewrites?.results).toEqual([]);
  });

  it('omits contextual rewrites when final decision is not WARN', async () => {
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
