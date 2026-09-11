import { describe, expect, it } from 'vitest';
import type { ClaimOpinion } from '@aairp/shared-kernel';
import {
  copySectionStatus,
  evidenceSectionStatus,
  filterCopyOpinions,
  filterEvidenceOpinions,
} from './review-result-view';

function opinion(partial: Partial<ClaimOpinion> & Pick<ClaimOpinion, 'kind'>): ClaimOpinion {
  return {
    label: partial.label ?? partial.kind,
    summary: partial.summary ?? '',
    claim_anchor: partial.claim_anchor ?? 'anchor',
    finding_ids: partial.finding_ids ?? [],
    ref_ids: partial.ref_ids ?? [],
    ...partial,
  };
}

describe('review-result-view', () => {
  it('splits copy vs evidence opinions', () => {
    const opinions = [
      opinion({ kind: 'prohibited' }),
      opinion({ kind: 'unused_evidence' }),
      opinion({ kind: 'substantiation_supports' }),
    ];
    expect(filterCopyOpinions(opinions)).toHaveLength(2);
    expect(filterEvidenceOpinions(opinions)).toHaveLength(2);
  });

  it('marks evidence section as cleared when flagged', () => {
    const status = evidenceSectionStatus(
      [opinion({ kind: 'substantiation_supports', evidence: [{ evidence_id: 'e1', title: 't', filename: 'a.pdf' }] })],
      true,
    );
    expect(status.decision).toBe('PASS');
    expect(status.label).toBe('材料可支持');
  });

  it('marks evidence section as none when no files submitted', () => {
    const status = evidenceSectionStatus([opinion({ kind: 'needs_substantiation' })]);
    expect(status.decision).toBe('NONE');
    expect(status.label).toBe('未附材料');
  });

  it('marks optional evidence as not evaluated instead of unrelated', () => {
    const status = evidenceSectionStatus([
      opinion({
        kind: 'evidence_not_evaluated',
        label: '材料未进入实证判断',
        summary: '附件未进入实证判断。',
      }),
    ]);
    expect(status.decision).toBe('NOT_EVALUATED');
    expect(status.label).toBe('材料未进入实证判断');
    expect(status.summary).not.toContain('无关');
    expect(status.summary).not.toContain('未能对应');
  });

  it('keeps judged unused_evidence as 材料未对应', () => {
    const status = evidenceSectionStatus([opinion({ kind: 'unused_evidence' })]);
    expect(status.decision).toBe('WARN');
    expect(status.label).toBe('材料未对应');
  });

  it('derives copy section from copy decision', () => {
    expect(copySectionStatus('WARN', 2).label).toBe('需关注');
    expect(copySectionStatus('PASS', 0).decision).toBe('PASS');
  });
});
