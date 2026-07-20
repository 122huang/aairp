import { describe, expect, it } from 'vitest';
import {
  claimAnchorGroupKey,
  groupFindingsByClaimAnchor,
  resolveClaimAnchorText,
  type ClaimAnchorSource,
} from './claim-anchor.js';

function finding(
  partial: Partial<ClaimAnchorSource> & Pick<ClaimAnchorSource, 'finding_id'>,
): ClaimAnchorSource {
  return {
    finding_id: partial.finding_id,
    summary: partial.summary ?? 'Quantitative claim',
    evidence_spans: partial.evidence_spans,
    rewrite_suggestions: partial.rewrite_suggestions,
  };
}

describe('claim_anchor evidence grouping', () => {
  it('groups up to 70% / 70% faster spans into one key', () => {
    const a = finding({
      finding_id: 'f1',
      evidence_spans: [{ text: 'Up to 70%' }],
    });
    const b = finding({
      finding_id: 'f2',
      evidence_spans: [{ text: '70% faster' }],
    });
    expect(claimAnchorGroupKey(a)).toBe(claimAnchorGroupKey(b));
    expect(claimAnchorGroupKey(a)).toBe('pct:70');
  });

  it('keeps oil-dimension 70% separate from speed 70%', () => {
    const speed = finding({
      finding_id: 'f1',
      evidence_spans: [{ text: 'up to 70% faster' }],
    });
    const oil = finding({
      finding_id: 'f2',
      evidence_spans: [{ text: '70% less oil' }],
    });
    expect(claimAnchorGroupKey(speed)).not.toBe(claimAnchorGroupKey(oil));
  });

  it('groupFindingsByClaimAnchor fans multiple modules into one card group', () => {
    const findings = [
      finding({
        finding_id: 'rule',
        evidence_spans: [{ text: 'Up to 70%' }],
      }),
      finding({
        finding_id: 'pb',
        evidence_spans: [{ text: 'Cook Up to 70% faster' }],
      }),
      finding({
        finding_id: 'llm',
        evidence_spans: [{ text: 'up to 70% faster' }],
      }),
    ];
    const groups = groupFindingsByClaimAnchor(findings);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.findings.map((f) => f.finding_id).sort()).toEqual(['llm', 'pb', 'rule']);
    expect(resolveClaimAnchorText(findings[1]!).length).toBeGreaterThan(
      resolveClaimAnchorText(findings[0]!).length,
    );
    expect(groups[0]?.claimAnchor).toBe('Cook Up to 70% faster');
  });
});
