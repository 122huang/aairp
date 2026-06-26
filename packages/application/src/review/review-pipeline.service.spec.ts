import { describe, expect, it } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { DecisionEngineService } from './decision-engine.service.js';
import { OpenRiskDiscoveryService } from './open-risk-discovery.service.js';
import { PlaybookEngineService } from './playbook-engine.service.js';
import { ReviewPipelineService } from './review-pipeline.service.js';
import { ReviewReportService } from './review-report.service.js';
import { RuleEngineService } from './rule-engine.service.js';

const baseContext: ReviewContext = {
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

function createPipelineService() {
  return new ReviewPipelineService({
    ruleEngineService: new RuleEngineService(),
    playbookEngineService: new PlaybookEngineService(),
    openRiskDiscoveryService: new OpenRiskDiscoveryService(),
    decisionEngineService: new DecisionEngineService(),
    reviewReportService: new ReviewReportService(),
  });
}

describe('ReviewPipelineService', () => {
  it('runThroughDecision returns REJECT for blocker ad', async () => {
    const service = createPipelineService();
    const result = await service.runThroughDecision(baseContext);

    expect(result.decision.finalDecision).toBe('REJECT');
    expect(result.openRiskResult.skipped).toBe(true);
    expect(result.timings.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.timings.ruleMs).toBeGreaterThanOrEqual(0);
  });

  it('runThroughReport includes html report', async () => {
    const service = createPipelineService();
    const result = await service.runThroughReport({
      ...baseContext,
      normalizedContent: { text: 'Daily vitamins for general wellness.', imageUrls: [] },
    });

    expect(result.decision.finalDecision).toBe('PASS');
    expect(result.report.reportHtml).toContain('PASS');
    expect(result.timings.reportMs).toBeGreaterThanOrEqual(0);
  });
});
