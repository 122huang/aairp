import { describe, expect, it, vi } from 'vitest';
import type { LlmFinding, ReviewContext, RuleFinding } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { DecisionEngineService } from './decision-engine.service.js';
import { OpenRiskDiscoveryService } from './open-risk-discovery.service.js';
import { RuleEngineService } from './rule-engine.service.js';
import type { ILlmGateway } from './stub-llm.gateway.types.js';

/**
 * Knowledge Compiler Eval gate — legal iron laws.
 * Rule pack / Hook Spec changes MUST keep this suite green.
 *
 *   pnpm --filter @aairp/application exec vitest run src/review/decision-invariants.spec.ts
 */

const fixedDate = new Date('2026-07-31T02:00:00.000Z');

function fuseService() {
  return new DecisionEngineService({ now: () => fixedDate });
}

const baseContext: ReviewContext = {
  reviewId: 'rev_invariants',
  advertisementId: 'ad_invariants',
  contentHash: 'hash_invariants',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'META',
    categoryId: 'sa.rice_cooker',
  },
  normalizedContent: { text: 'sample', imageUrls: [] },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-07-31T02:00:00.000Z',
};

const llmRejectAttempt: LlmFinding = {
  module: 'LLM',
  findingId: 'lf_reject_attempt',
  severity: 'HIGH',
  decision: 'FAIL',
  refType: 'LLM_RISK',
  refId: 'absolute-claim-blocker',
  refVersionId: 'absolute-claim-blocker-v1',
  summary: 'LLM alone asserts REJECT',
  confidence: 0.99,
  evaluationDetail: {
    riskType: 'absolute-claim-blocker',
    // Runtime LLM actions are WARN|MANUAL_REVIEW only; FAIL decision models a hostile/over-claim payload.
    suggestedAction: 'MANUAL_REVIEW',
  },
};

const llmWarn: LlmFinding = {
  module: 'LLM',
  findingId: 'lf_warn',
  severity: 'MEDIUM',
  decision: 'WARN',
  refType: 'LLM_RISK',
  refId: 'comparative-claim',
  refVersionId: 'comparative-claim-v1',
  summary: 'Soft semantic warn',
  confidence: 0.7,
  evaluationDetail: {
    riskType: 'comparative-claim',
    suggestedAction: 'WARN',
  },
};

const ruleBlocker: RuleFinding = {
  module: 'RULE',
  findingId: 'rf_blocker',
  severity: 'BLOCKER',
  decision: 'FAIL',
  refType: 'RULE',
  refId: 'demo-apac-sa-absolute-claim',
  refVersionId: 'demo-apac-sa-absolute-claim-v7',
  summary: 'Absolute claim blocker',
  confidence: 1,
};

describe('decision-invariants (Compiler Eval gate)', () => {
  it('BLOCKER skips Open Risk (HAS_BLOCKER)', async () => {
    const gateway: ILlmGateway = { complete: vi.fn() };
    const openRisk = new OpenRiskDiscoveryService({
      now: () => fixedDate,
      llmGateway: gateway,
    });

    const result = await openRisk.discover(baseContext, {
      hasBlocker: true,
      ruleFindings: [
        {
          refId: ruleBlocker.refId,
          summary: ruleBlocker.summary,
          severity: ruleBlocker.severity,
          decision: ruleBlocker.decision,
        },
      ],
      playbookFindings: [],
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('HAS_BLOCKER');
    expect(result.findings).toHaveLength(0);
    expect(gateway.complete).not.toHaveBeenCalled();
  });

  it('fusion priority: hasBlocker forces REJECT even if LLM is WARN', () => {
    const result = fuseService().fuseFromFindings({
      reviewId: 'rev_invariants',
      hasBlocker: true,
      ruleFindings: [ruleBlocker],
      playbookFindings: [],
      llmFindings: [llmWarn],
    });
    expect(result.finalDecision).toBe('REJECT');
  });

  it('fusion priority: REVIEW outranks WARN', () => {
    const ruleReview: RuleFinding = {
      ...ruleBlocker,
      findingId: 'rf_review',
      severity: 'HIGH',
      decision: 'REVIEW',
      refId: 'demo-apac-sa-health-implication',
    };
    const result = fuseService().fuseFromFindings({
      reviewId: 'rev_invariants',
      hasBlocker: false,
      ruleFindings: [ruleReview],
      playbookFindings: [],
      llmFindings: [llmWarn],
    });
    expect(result.finalDecision).toBe('REVIEW');
  });

  it('LLM cannot sole REJECT', () => {
    const result = fuseService().fuseFromFindings({
      reviewId: 'rev_invariants',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [llmRejectAttempt],
    });
    expect(result.finalDecision).not.toBe('REJECT');
  });

  it('CN absolute terms FAIL via Rule BLOCKER path', () => {
    const rules = new RuleEngineService();
    const result = rules.evaluate({
      ...baseContext,
      dimensions: {
        ...baseContext.dimensions,
        countryId: 'CN',
        categoryId: 'sa.air_fryer',
      },
      normalizedContent: {
        text: '国家级空气炸锅，最高级无油烹饪体验',
        imageUrls: [],
      },
    });
    expect(result.hasBlocker).toBe(true);
    expect(
      result.findings.some(
        (f) => f.refId === 'demo-cn-absolute-terms-blocker' && f.decision === 'FAIL',
      ),
    ).toBe(true);

    const fused = fuseService().fuseFromFindings({
      reviewId: 'rev_cn_abs',
      hasBlocker: result.hasBlocker,
      ruleFindings: result.findings,
      playbookFindings: [],
      llmFindings: [llmWarn],
    });
    expect(fused.finalDecision).toBe('REJECT');
  });
});
