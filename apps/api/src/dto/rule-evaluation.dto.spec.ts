import { describe, expect, it } from 'vitest';
import { toRuleEvaluationResponseDto } from './rule-evaluation.dto.js';

describe('rule-evaluation.dto', () => {
  it('maps RuleEvaluationResult to snake_case response', () => {
    const dto = toRuleEvaluationResponseDto({
      reviewId: 'rev_test',
      rulePackVersion: 'demo-rule-1.0.0',
      hasBlocker: true,
      evaluatedAt: '2026-06-26T10:06:00.000Z',
      findings: [
        {
          module: 'RULE',
          findingId: 'rf_test',
          severity: 'BLOCKER',
          decision: 'FAIL',
          refType: 'RULE',
          refId: 'demo-sg-health-forbidden-claim',
          refVersionId: 'demo-sg-health-forbidden-claim-v1',
          summary: 'Prohibited absolute health cure claims are not allowed',
          confidence: 1,
          evaluationDetail: {
            matchedSpans: [{ field: 'text', start: 20, end: 24, text: 'cure' }],
            citation: {
              lawName: 'SG Health Products Act (Demo)',
              article: 'Section 7 — Prohibited claims',
            },
          },
        },
      ],
    });

    expect(dto).toEqual({
      review_id: 'rev_test',
      rule_pack_version: 'demo-rule-1.0.0',
      has_blocker: true,
      evaluated_at: '2026-06-26T10:06:00.000Z',
      findings: [
        {
          finding_id: 'rf_test',
          module: 'RULE',
          severity: 'BLOCKER',
          decision: 'FAIL',
          ref_type: 'RULE',
          ref_id: 'demo-sg-health-forbidden-claim',
          ref_version_id: 'demo-sg-health-forbidden-claim-v1',
          summary: 'Prohibited absolute health cure claims are not allowed',
          confidence: 1,
          evaluation_detail: {
            matched_spans: [{ field: 'text', start: 20, end: 24, text: 'cure' }],
            citation: {
              law_name: 'SG Health Products Act (Demo)',
              article: 'Section 7 — Prohibited claims',
            },
          },
        },
      ],
    });
  });

  it('omits evaluation_detail when finding has no evaluation detail', () => {
    const dto = toRuleEvaluationResponseDto({
      reviewId: 'rev_test',
      rulePackVersion: 'demo-rule-1.0.0',
      hasBlocker: false,
      evaluatedAt: '2026-06-26T10:06:00.000Z',
      findings: [
        {
          module: 'RULE',
          findingId: 'rf_disclosure',
          severity: 'LOW',
          decision: 'WARN',
          refType: 'RULE',
          refId: 'demo-sg-sponsored-disclosure',
          refVersionId: 'demo-sg-sponsored-disclosure-v1',
          summary: 'Sponsored or promotional content should include an ad disclosure',
          confidence: 1,
        },
      ],
    });

    expect(dto.findings[0]).not.toHaveProperty('evaluation_detail');
  });
});
