import { describe, expect, it } from 'vitest';
import type { ReviewFindingDto } from '../api/review.js';
import { mergeFindingsByClaimAnchor } from './finding-merge.js';

function rewrite(
  partial: Partial<NonNullable<ReviewFindingDto['rewrite_suggestions']>[number]> &
    Pick<NonNullable<ReviewFindingDto['rewrite_suggestions']>[number], 'suggestion_id' | 'risk_type'>,
): NonNullable<ReviewFindingDto['rewrite_suggestions']>[number] {
  return {
    finding_id: partial.finding_id ?? 'f',
    rewrite_template_id: partial.rewrite_template_id ?? 'tpl',
    original_span: partial.original_span ?? { field: 'text', text: '' },
    suggested_text: partial.suggested_text ?? [],
    rationale: partial.rationale ?? '',
    confidence: partial.confidence ?? 0.9,
    ...partial,
  };
}

function finding(
  partial: Partial<ReviewFindingDto> & Pick<ReviewFindingDto, 'finding_id'>,
): ReviewFindingDto {
  return {
    finding_id: partial.finding_id,
    module: partial.module ?? 'RULE',
    ref_id: partial.ref_id ?? partial.finding_id,
    severity: partial.severity ?? 'MEDIUM',
    decision: partial.decision ?? 'WARN',
    summary: partial.summary ?? 'Quantitative claim',
    evidence_spans: partial.evidence_spans,
    rewrite_suggestions: partial.rewrite_suggestions,
  };
}

describe('mergeFindingsByClaimAnchor', () => {
  it('merges same claim anchor with different risk types into one card', () => {
    const findings = [
      finding({
        finding_id: 'f1',
        evidence_spans: [{ field: 'text', text: 'Up to 70%' }],
        rewrite_suggestions: [rewrite({ suggestion_id: 's1', risk_type: 'performance-claim' })],
      }),
      finding({
        finding_id: 'f2',
        module: 'LLM',
        evidence_spans: [{ field: 'text', text: '70% faster' }],
        rewrite_suggestions: [rewrite({ suggestion_id: 's2', risk_type: 'absolute-claim-soft' })],
      }),
    ];

    const merged = mergeFindingsByClaimAnchor(findings);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.findingIds.sort()).toEqual(['f1', 'f2']);
    expect(merged[0]?.items.map((item) => item.riskType).sort()).toEqual([
      'absolute-claim-soft',
      'performance-claim',
    ]);
    expect(merged[0]?.claimAnchor).toBe('70% faster');
  });

  it('keeps findings without a shared anchor as separate cards', () => {
    const findings = [
      finding({
        finding_id: 'a',
        evidence_spans: [{ field: 'text', text: 'Up to 70%' }],
        rewrite_suggestions: [rewrite({ suggestion_id: 's1', risk_type: 'performance-claim' })],
      }),
      finding({
        finding_id: 'b',
        evidence_spans: [{ field: 'text', text: '70% less oil' }],
        rewrite_suggestions: [rewrite({ suggestion_id: 's2', risk_type: 'health-implication' })],
      }),
    ];

    const merged = mergeFindingsByClaimAnchor(findings);
    expect(merged).toHaveLength(2);
  });

  it('uses summary text as group key when evidence spans are missing', () => {
    const findings = [
      finding({
        finding_id: 'solo-a',
        summary: 'No span',
        rewrite_suggestions: [rewrite({ suggestion_id: 's1', risk_type: 'performance-claim' })],
      }),
      finding({
        finding_id: 'solo-b',
        summary: 'Also no span',
        rewrite_suggestions: [rewrite({ suggestion_id: 's2', risk_type: 'health-implication' })],
      }),
    ];

    const merged = mergeFindingsByClaimAnchor(findings);
    expect(merged).toHaveLength(2);
    expect(merged.map((card) => card.groupKey).sort()).toEqual(['also no span', 'no span']);
  });
});
