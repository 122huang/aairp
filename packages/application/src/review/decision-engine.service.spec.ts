import { describe, expect, it } from 'vitest';
import type { CaseFinding, LlmFinding, PlaybookFinding, RuleFinding } from '@aairp/shared-kernel';
import {
  DecisionEngineService,
  buildDecisionFusionInput,
} from './decision-engine.service.js';

const fixedDate = new Date('2026-06-26T10:09:00.000Z');

function createService() {
  return new DecisionEngineService({
    now: () => fixedDate,
  });
}

const ruleWarnFinding: RuleFinding = {
  module: 'RULE',
  findingId: 'rf_warn',
  severity: 'MEDIUM',
  decision: 'WARN',
  refType: 'RULE',
  refId: 'demo-sg-health-superlative',
  refVersionId: 'demo-sg-health-superlative-v1',
  summary: 'Superlative claim',
  confidence: 0.9,
};

const playbookReviewFinding: PlaybookFinding = {
  module: 'PLAYBOOK',
  findingId: 'pf_review',
  severity: 'MEDIUM',
  decision: 'REVIEW',
  refType: 'PLAYBOOK_PATTERN',
  refId: 'unsubstantiated-testimonial',
  refVersionId: 'unsubstantiated-testimonial-v1',
  summary: 'Testimonial guidance',
  confidence: 0.8,
};

const llmWarnFinding: LlmFinding = {
  module: 'LLM',
  findingId: 'lf_warn',
  severity: 'MEDIUM',
  decision: 'WARN',
  refType: 'LLM_RISK',
  refId: 'combined-misleading-claim',
  refVersionId: 'combined-misleading-claim-v1',
  summary: 'Semantic combination risk',
  confidence: 0.72,
};

describe('DecisionEngineService', () => {
  it('returns REJECT with confidence 1 when hasBlocker is true', () => {
    const service = createService();

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: true,
      ruleFindings: [ruleWarnFinding],
      playbookFindings: [playbookReviewFinding],
      llmFindings: [llmWarnFinding],
    });

    expect(result).toMatchObject({
      reviewId: 'rev_test',
      finalDecision: 'REJECT',
      confidence: 1,
      findingCounts: { rule: 1, playbook: 1, llm: 1, case: 0 },
      decidedAt: '2026-06-26T10:09:00.000Z',
    });
    expect(result.rationale).toContain('Rejected due to blocking rule finding');
  });

  it('returns WARN with higher confidence when rule warnings exist', () => {
    const service = createService();

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [ruleWarnFinding],
      playbookFindings: [],
      llmFindings: [],
    });

    expect(result.finalDecision).toBe('WARN');
    expect(result.confidence).toBe(0.9);
  });

  it('returns WARN with lower confidence for playbook-only findings', () => {
    const service = createService();

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [playbookReviewFinding],
      llmFindings: [],
    });

    expect(result.finalDecision).toBe('WARN');
    expect(result.confidence).toBe(0.78);
  });

  it('returns WARN for llm-only findings', () => {
    const service = createService();

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [llmWarnFinding],
    });

    expect(result.finalDecision).toBe('WARN');
    expect(result.confidence).toBe(0.75);
  });

  it('returns PASS when no findings exist', () => {
    const service = createService();

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [],
    });

    expect(result).toMatchObject({
      reviewId: 'rev_test',
      finalDecision: 'PASS',
      confidence: 0.95,
      findingCounts: { rule: 0, playbook: 0, llm: 0, case: 0 },
      decidedAt: '2026-06-26T10:09:00.000Z',
    });
    expect(result.rationale).toContain('No blocking or warning findings');
  });

  it('includes blocker ref id in REJECT rationale', () => {
    const service = createService();
    const blockerFinding: RuleFinding = {
      module: 'RULE',
      findingId: 'rf_blocker',
      severity: 'BLOCKER',
      decision: 'FAIL',
      refType: 'RULE',
      refId: 'demo-sg-health-forbidden-claim',
      refVersionId: 'demo-sg-health-forbidden-claim-v1',
      summary: 'Forbidden cure claim',
      confidence: 1,
    };

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: true,
      ruleFindings: [blockerFinding],
      playbookFindings: [],
      llmFindings: [],
    });

    expect(result.rationale).toContain('demo-sg-health-forbidden-claim');
  });

  it('buildDecisionFusionInput detects manual review signals', () => {
    const input = buildDecisionFusionInput({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [{ ...playbookReviewFinding, decision: 'CONDITIONAL' }],
      llmFindings: [
        {
          ...llmWarnFinding,
          decision: 'REVIEW',
          evaluationDetail: { suggestedAction: 'MANUAL_REVIEW' },
        },
      ],
    });

    expect(input.hasPlaybookReviewSignal).toBe(true);
    expect(input.hasLlmManualReviewSignal).toBe(true);
  });

  it('returns WARN with case-confirmed signal confidence when case findings are present', () => {
    const service = createService();
    const caseFinding: CaseFinding = {
      module: 'CASE',
      findingId: 'cf_test',
      severity: 'MEDIUM',
      decision: 'WARN',
      refType: 'CASE_PRECEDENT',
      refId: 'case_example',
      refVersionId: 'case_example-v1',
      summary: '2 similar CONFIRMED cases were REJECT',
      confidence: 0.88,
      evaluationDetail: {
        similarityScore: 0.91,
        precedentFinalDecision: 'REJECT',
        lifecycleStatus: 'CONFIRMED',
        precedentCaseIds: ['case_a', 'case_b'],
      },
    };

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [],
      caseFindings: [caseFinding],
    });

    expect(result.finalDecision).toBe('WARN');
    expect(result.confidence).toBe(0.82);
    expect(result.findingCounts.case).toBe(1);
    expect(result.rationale).toContain('CASE/case_example');
  });
});
