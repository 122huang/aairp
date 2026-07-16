import { describe, expect, it } from 'vitest';
import {
  mapRuleRefToRiskTypes,
  scoreGrayCopyCapability,
} from './gray-copy-scoring.js';

describe('mapRuleRefToRiskTypes', () => {
  it('maps SG sponsored disclosure to sponsored-disclosure', () => {
    expect(mapRuleRefToRiskTypes('demo-sg-sponsored-disclosure')).toEqual([
      'sponsored-disclosure',
    ]);
  });

  it('maps CPSR/COE to empty (orthogonal registration risks)', () => {
    expect(mapRuleRefToRiskTypes('demo-sg-cpsr-registration-prerequisite')).toEqual(
      [],
    );
    expect(mapRuleRefToRiskTypes('demo-my-eeca-coe-prerequisite')).toEqual([]);
  });

  it('maps children/sensitive MANUAL_REVIEW rules to recall risk types', () => {
    expect(mapRuleRefToRiskTypes('demo-au-children-code-review')).toEqual([
      'aana-children-code-risk',
    ]);
    expect(mapRuleRefToRiskTypes('demo-cn-sensitive-content-manual-review')).toEqual([
      'sensitive-content-flag',
    ]);
  });
});

describe('scoreGrayCopyCapability', () => {
  it('SG-07 style: same-risk Rule cover counts as PASS even when LLM empty', () => {
    const scored = scoreGrayCopyCapability({
      open_risk_must_fire: true,
      acceptable_risk_types: ['sponsored-disclosure'],
      final_decision: 'REVIEW',
      hit_sources: [
        {
          module: 'RULE',
          ref_id: 'demo-sg-sponsored-disclosure',
          incidental: true,
        },
        {
          module: 'RULE',
          ref_id: 'demo-sg-cpsr-registration-prerequisite',
          incidental: true,
        },
      ],
    });
    expect(scored.llm_matched).toBe(false);
    expect(scored.rule_covered_same_risk).toBe(true);
    expect(scored.coincidence_kind).toBe('rule_covered_same_risk');
    expect(scored.coincidence_only).toBe(false);
    expect(scored.open_risk_capability_pass).toBe(true);
  });

  it('SG-08/MY-01 style: unrelated incidental only is FAIL masked_by_unrelated', () => {
    const scored = scoreGrayCopyCapability({
      open_risk_must_fire: true,
      acceptable_risk_types: ['scarcity-urgency-claim', 'absolute-claim-soft'],
      final_decision: 'REVIEW',
      hit_sources: [
        {
          module: 'RULE',
          ref_id: 'demo-sg-sponsored-disclosure',
          incidental: true,
        },
        {
          module: 'RULE',
          ref_id: 'demo-sg-cpsr-registration-prerequisite',
          incidental: true,
        },
      ],
    });
    expect(scored.rule_covered_same_risk).toBe(false);
    expect(scored.coincidence_kind).toBe('masked_by_unrelated');
    expect(scored.coincidence_only).toBe(true);
    expect(scored.open_risk_capability_pass).toBe(false);
  });

  it('LLM hit still PASSes without Rule cover', () => {
    const scored = scoreGrayCopyCapability({
      open_risk_must_fire: true,
      acceptable_risk_types: ['health-implication', 'medical-claim'],
      final_decision: 'WARN',
      hit_sources: [
        { module: 'LLM', ref_id: 'health-implication', incidental: false },
      ],
    });
    expect(scored.coincidence_kind).toBeNull();
    expect(scored.open_risk_capability_pass).toBe(true);
  });
});
