import { describe, expect, it } from 'vitest';
import type { CaseFinding, LlmFinding, PlaybookFinding, RuleFinding, VisionFinding } from '@aairp/shared-kernel';
import {
  DecisionEngineService,
  applyCountryConfidenceModifier,
  buildDecisionFusionInput,
  computeCombinedHasBlocker,
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
      findingCounts: { rule: 1, playbook: 1, llm: 1, case: 0, vision: 0 },
      decidedAt: '2026-06-26T10:09:00.000Z',
    });
    expect(result.rationale).toContain('Rejected due to blocking finding');
  });

  it('returns REJECT when vision BLOCKER finding is present', () => {
    const service = createService();
    const visionBlocker: VisionFinding = {
      module: 'VISION',
      findingId: 'vf_blocker',
      severity: 'BLOCKER',
      decision: 'FAIL',
      refType: 'VISION_RISK',
      refId: 'sa-competitor-trademark',
      refVersionId: 'demo-vision-1.0.0-sa-competitor-trademark-v1',
      summary: 'Competitor logo visible without authorisation',
      confidence: 0.95,
      sliceId: 'img0-s0-hero',
      evaluationDetail: {
        riskType: 'sa-competitor-trademark',
        suggestedAction: 'REJECT',
        scanDimension: 'scene_content',
        evidenceSpans: [
          {
            field: 'image',
            sliceIndex: 0,
            regionDescription: 'top-right corner logo',
            text: 'Dyson',
          },
        ],
      },
    };

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: computeCombinedHasBlocker({
        ruleHasBlocker: false,
        visionFindings: [visionBlocker],
      }),
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [],
      visionFindings: [visionBlocker],
    });

    expect(result.finalDecision).toBe('REJECT');
    expect(result.confidence).toBe(1);
    expect(result.findingCounts.vision).toBe(1);
    expect(result.rationale).toContain('VISION/sa-competitor-trademark');
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

  it('returns REVIEW for playbook findings with decision REVIEW', () => {
    const service = createService();

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [playbookReviewFinding],
      llmFindings: [],
    });

    expect(result.finalDecision).toBe('REVIEW');
    expect(result.confidence).toBe(0.78);
    expect(result.rationale).toContain('Manual review required');
  });

  it('returns REVIEW for rule-only REVIEW findings (must not collapse to PASS or WARN)', () => {
    const service = createService();
    const ruleReviewFinding: RuleFinding = {
      module: 'RULE',
      findingId: 'rf_review',
      severity: 'MEDIUM',
      decision: 'REVIEW',
      refType: 'RULE',
      refId: 'demo-au-children-code-review',
      refVersionId: 'demo-au-children-code-review-v1',
      summary: 'AANA children advertising code requires human review',
      confidence: 0.9,
    };

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [ruleReviewFinding],
      playbookFindings: [],
      llmFindings: [],
    });

    expect(result.finalDecision).toBe('REVIEW');
    expect(result.confidence).toBe(0.78);
  });

  it('returns PASS for rule-only INFO findings (informational, non-blocking)', () => {
    const service = createService();
    const ruleInfoFinding: RuleFinding = {
      module: 'RULE',
      findingId: 'rf_info',
      severity: 'HIGH',
      decision: 'INFO',
      refType: 'RULE',
      refId: 'demo-sg-cpsr-registration-prerequisite',
      refVersionId: 'demo-sg-cpsr-registration-prerequisite-v1',
      summary: 'CPSR registration prerequisite reminder',
      confidence: 0.9,
    };

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [ruleInfoFinding],
      playbookFindings: [],
      llmFindings: [],
    });

    expect(result.finalDecision).toBe('PASS');
    expect(result.confidence).toBe(0.95);
    expect(result.rationale).toContain('informational notices');
    expect(result.rationale).not.toContain('Warning issued');
    expect(result.rationale).not.toContain('Manual review required');
  });

  it('returns WARN for playbook CONDITIONAL findings (not REVIEW)', () => {
    const service = createService();
    const conditionalFinding: PlaybookFinding = {
      ...playbookReviewFinding,
      findingId: 'pf_conditional',
      decision: 'CONDITIONAL',
      refId: 'before-after-imagery',
      refVersionId: 'before-after-imagery-v1',
    };

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [conditionalFinding],
      llmFindings: [],
    });

    expect(result.finalDecision).toBe('WARN');
    expect(result.confidence).toBe(0.78);
  });

  it('prefers REVIEW over WARN when both soft findings and review signals are present', () => {
    const service = createService();

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [ruleWarnFinding],
      playbookFindings: [playbookReviewFinding],
      llmFindings: [],
    });

    expect(result.finalDecision).toBe('REVIEW');
  });

  it('returns WARN for llm-only soft findings', () => {
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

  it('returns REVIEW for llm MANUAL_REVIEW suggestedAction', () => {
    const service = createService();

    const result = service.fuseFromFindings({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [
        {
          ...llmWarnFinding,
          decision: 'REVIEW',
          evaluationDetail: { suggestedAction: 'MANUAL_REVIEW' },
        },
      ],
    });

    expect(result.finalDecision).toBe('REVIEW');
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
      findingCounts: { rule: 0, playbook: 0, llm: 0, case: 0, vision: 0 },
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

  it('buildDecisionFusionInput separates REVIEW from CONDITIONAL playbook signals', () => {
    const conditionalOnly = buildDecisionFusionInput({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [{ ...playbookReviewFinding, decision: 'CONDITIONAL' }],
      llmFindings: [],
    });
    expect(conditionalOnly.hasPlaybookReviewSignal).toBe(false);
    expect(conditionalOnly.hasPlaybookConditionalSignal).toBe(true);

    const reviewAndLlm = buildDecisionFusionInput({
      reviewId: 'rev_test',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [playbookReviewFinding],
      llmFindings: [
        {
          ...llmWarnFinding,
          decision: 'REVIEW',
          evaluationDetail: { suggestedAction: 'MANUAL_REVIEW' },
        },
      ],
    });

    expect(reviewAndLlm.hasPlaybookReviewSignal).toBe(true);
    expect(reviewAndLlm.hasPlaybookConditionalSignal).toBe(false);
    expect(reviewAndLlm.hasLlmManualReviewSignal).toBe(true);
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

  it('applyCountryConfidenceModifier clamps PH enforcement-density adjustment', () => {
    expect(applyCountryConfidenceModifier(0.9, 'PH')).toBe(0.8);
    expect(applyCountryConfidenceModifier(0.05, 'PH')).toBe(0);
    expect(applyCountryConfidenceModifier(0.9, 'SG')).toBe(0.9);
  });

  it('reduces WARN confidence for PH market without affecting PASS or REJECT', () => {
    const service = createService();

    const warnResult = service.fuseFromFindings({
      reviewId: 'rev_ph',
      countryId: 'PH',
      hasBlocker: false,
      ruleFindings: [ruleWarnFinding],
      playbookFindings: [],
      llmFindings: [],
    });
    expect(warnResult.finalDecision).toBe('WARN');
    expect(warnResult.confidence).toBe(0.8);

    const passResult = service.fuseFromFindings({
      reviewId: 'rev_ph_pass',
      countryId: 'PH',
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [],
    });
    expect(passResult.finalDecision).toBe('PASS');
    expect(passResult.confidence).toBe(0.95);

    const rejectResult = service.fuseFromFindings({
      reviewId: 'rev_ph_reject',
      countryId: 'PH',
      hasBlocker: true,
      ruleFindings: [ruleWarnFinding],
      playbookFindings: [],
      llmFindings: [],
    });
    expect(rejectResult.finalDecision).toBe('REJECT');
    expect(rejectResult.confidence).toBe(1);
  });
});
