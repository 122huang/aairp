import { describe, expect, it, vi } from 'vitest';
import type { ReviewReportFindingSummary } from '@aairp/shared-kernel';
import { composeClaimOpinions, type ClaimOpinionLinkInput } from './claim-opinion.compose.js';
import { runClaimOpinionPreReview } from './claim-opinion-pre-review.js';
import type { EvidenceService } from './evidence.service.js';

function finding(
  partial: Partial<ReviewReportFindingSummary> &
    Pick<ReviewReportFindingSummary, 'findingId' | 'summary'>,
): ReviewReportFindingSummary {
  return {
    module: 'RULE',
    refId: partial.refId ?? partial.findingId,
    severity: 'HIGH',
    decision: partial.decision ?? 'REJECT',
    ...partial,
  };
}

function link(
  partial: Partial<ClaimOpinionLinkInput> &
    Pick<ClaimOpinionLinkInput, 'finding_id' | 'evidence_id'>,
): ClaimOpinionLinkInput {
  return {
    evidence: {
      title: partial.evidence?.title ?? 'SGS',
      file: { filename: partial.evidence?.file.filename ?? 'SGS.pdf' },
    },
    ...partial,
  };
}

describe('composeClaimOpinions', () => {
  it('emits 须有依据 when attachable findings have no materials', () => {
    const opinions = composeClaimOpinions({
      findings: [
        finding({
          findingId: 'f-cap',
          summary: '업계 최강 흡입력 200AW',
          decision: 'WARN',
          remediationType: 'EVIDENCE_SUPPLEMENT',
          evidenceSpans: [{ field: 'text', text: '최강 흡입력 200AW' }],
        }),
      ],
      links: [],
      poolFileCount: 0,
    });
    expect(opinions).toHaveLength(1);
    expect(opinions[0].kind).toBe('needs_substantiation');
    expect(opinions[0].label).toBe('须有依据');
  });

  it('keeps SG medical claims prohibited even when a lab report is attached', () => {
    const opinions = composeClaimOpinions({
      findings: [
        finding({
          findingId: 'f-sg',
          summary: 'treats a cold',
          decision: 'REJECT',
          remediationType: 'REWRITE_ONLY',
          evidenceSpans: [{ field: 'text', text: 'treats a cold' }],
        }),
      ],
      links: [
        link({
          finding_id: 'f-sg',
          evidence_id: 'ev-sgs',
          ai_judgment: {
            relevance: 'strong',
            relevance_reasoning: 'report mentions product',
            sufficiency: 'sufficient',
            sufficiency_reasoning: 'lab data present',
            extracted_key_facts: '200AW',
            judged_at: '2026-08-25T00:00:00.000Z',
          },
        }),
      ],
      poolFileCount: 1,
    });
    const claim = opinions.find((item) => item.kind === 'prohibited');
    expect(claim?.label).toBe('不得使用');
    expect(claim?.summary).toContain('不能改变这一结论');
    expect(opinions.some((item) => item.kind === 'substantiation_supports')).toBe(false);
  });

  it('marks KR substantiable claims as 材料可支持 when judgment is sufficient', () => {
    const opinions = composeClaimOpinions({
      findings: [
        finding({
          findingId: 'f-kr',
          summary: '최강 흡입력 200AW',
          decision: 'WARN',
          remediationType: 'EVIDENCE_SUPPLEMENT',
          evidenceSpans: [{ field: 'text', text: '최강 흡입력 200AW' }],
        }),
      ],
      links: [
        link({
          finding_id: 'f-kr',
          evidence_id: 'ev-sgs',
          ai_judgment: {
            relevance: 'strong',
            relevance_reasoning: 'SKU PC201 matches',
            sufficiency: 'sufficient',
            sufficiency_reasoning: '200AW recorded',
            extracted_key_facts: 'PC201 200AW',
            judged_at: '2026-08-25T00:00:00.000Z',
          },
        }),
      ],
      poolFileCount: 1,
    });
    expect(opinions[0].kind).toBe('substantiation_supports');
    expect(opinions[0].label).toBe('材料可支持');
    expect(opinions[0].summary).toContain('材料可支持该表述');
    expect(opinions[0].summary).not.toContain('请复核');
    expect(opinions[0].evidence?.[0].excerpt).toBe('PC201 200AW');
  });

  it('does not treat wrong-model or expired material as supporting the claim', () => {
    const opinions = composeClaimOpinions({
      findings: [
        finding({
          findingId: 'f-kr',
          summary: '최강 흡입력 200AW',
          decision: 'WARN',
          remediationType: 'EVIDENCE_SUPPLEMENT',
        }),
      ],
      links: [
        link({
          finding_id: 'f-kr',
          evidence_id: 'ev-wrong',
          evidence: { title: 'SGS-40N1S', file: { filename: 'wrong-model.pdf' } },
          ai_judgment: {
            relevance: 'none',
            relevance_reasoning: 'SKU 40N1S 与本次 PC201 不符',
            sufficiency: 'insufficient',
            sufficiency_reasoning: '范围冲突',
            extracted_key_facts: '',
            prescreen_excluded: true,
            judged_at: '2026-08-25T00:00:00.000Z',
          },
        }),
      ],
      poolFileCount: 1,
    });
    expect(opinions.some((item) => item.kind === 'substantiation_weak')).toBe(true);
    expect(opinions.some((item) => item.kind === 'unused_evidence')).toBe(true);
    expect(opinions.some((item) => item.kind === 'substantiation_supports')).toBe(false);
    const unused = opinions.find((item) => item.kind === 'unused_evidence');
    expect(unused?.summary).toContain('wrong-model.pdf');
  });

  it('lists pool files as not evaluated when there is no attachable finding', () => {
    const opinions = composeClaimOpinions({
      findings: [
        finding({
          findingId: 'f-copy',
          summary: 'disclosure reminder',
          decision: 'INFO',
          remediationType: 'NOT_APPLICABLE_DISCLOSURE',
        }),
      ],
      links: [],
      poolFileCount: 1,
      poolFiles: [{ title: 'CLM-012884', filename: 'CLM-012884.pdf' }],
    });
    expect(opinions.some((item) => item.kind === 'copy_only')).toBe(true);
    const unevaluated = opinions.filter((item) => item.kind === 'evidence_not_evaluated');
    expect(unevaluated).toHaveLength(1);
    expect(unevaluated[0]?.label).toBe('材料未进入实证判断');
    expect(unevaluated[0]?.summary).toContain('未进入相关性及充分性判断');
    expect(unevaluated[0]?.summary).not.toContain('无关');
    expect(opinions.some((item) => item.kind === 'unused_evidence')).toBe(false);
  });

  it('marks every optional file not evaluated when none are judged (Case F)', () => {
    const opinions = composeClaimOpinions({
      findings: [],
      links: [],
      poolFileCount: 2,
      poolFiles: [
        { title: 'Manual', filename: 'manual.pdf' },
        { title: 'Other', filename: 'other.pdf' },
      ],
    });
    const unevaluated = opinions.filter((item) => item.kind === 'evidence_not_evaluated');
    expect(unevaluated).toHaveLength(2);
    expect(opinions.some((item) => item.kind === 'unused_evidence')).toBe(false);
  });

  it('keeps unused_evidence only after judged relevance=none (Case D)', () => {
    const opinions = composeClaimOpinions({
      findings: [
        finding({
          findingId: 'f-kr',
          summary: '최강 흡입력 200AW',
          decision: 'WARN',
          remediationType: 'EVIDENCE_SUPPLEMENT',
        }),
      ],
      links: [
        link({
          finding_id: 'f-kr',
          evidence_id: 'ev-wrong',
          evidence: { title: 'SGS-40N1S', file: { filename: 'wrong-model.pdf' } },
          ai_judgment: {
            relevance: 'none',
            relevance_reasoning: 'SKU 40N1S 与本次 PC201 不符',
            sufficiency: 'insufficient',
            sufficiency_reasoning: '范围冲突',
            extracted_key_facts: '',
            judged_at: '2026-08-25T00:00:00.000Z',
          },
        }),
      ],
      poolFileCount: 1,
    });
    expect(opinions.some((item) => item.kind === 'unused_evidence')).toBe(true);
    expect(opinions.some((item) => item.kind === 'evidence_not_evaluated')).toBe(false);
  });

  it('does not emit not-evaluated when the pool is empty (Case E)', () => {
    const opinions = composeClaimOpinions({
      findings: [
        finding({
          findingId: 'f-copy',
          summary: 'ok',
          decision: 'PASS',
        }),
      ],
      links: [],
      poolFileCount: 0,
      poolFiles: [],
    });
    expect(opinions.some((item) => item.kind === 'evidence_not_evaluated')).toBe(false);
    expect(opinions.some((item) => item.kind === 'unused_evidence')).toBe(false);
  });
});

describe('runClaimOpinionPreReview', () => {
  it('does not attach materials to REWRITE_ONLY findings', async () => {
    const attachPoolFile = vi.fn();
    const opinions = await runClaimOpinionPreReview(
      { attachPoolFile } as unknown as EvidenceService,
      {
        reviewId: 'rev_1',
        countryId: 'SG',
        categoryId: 'sa.vacuum_floor',
        adText: 'This product treats a cold.',
        findings: [
          finding({
            findingId: 'f-sg',
            summary: 'treats a cold',
            decision: 'REJECT',
            remediationType: 'REWRITE_ONLY',
          }),
        ],
        pool: [
          {
            filename: 'SGS.pdf',
            mime_type: 'application/pdf',
            content_base64: 'dGVzdA==',
            evidence_source_type: 'THIRD_PARTY_LAB',
          },
        ],
      },
    );
    expect(attachPoolFile).not.toHaveBeenCalled();
    expect(opinions.some((item) => item.kind === 'prohibited')).toBe(true);
    expect(opinions.some((item) => item.kind === 'evidence_not_evaluated')).toBe(true);
    expect(opinions.some((item) => item.kind === 'unused_evidence')).toBe(false);
  });

  it('still returns copy opinions when the pool is empty', async () => {
    const attachPoolFile = vi.fn();
    const opinions = await runClaimOpinionPreReview(
      { attachPoolFile } as unknown as EvidenceService,
      {
        reviewId: 'rev_1',
        countryId: 'KR',
        categoryId: 'sa.vacuum_floor',
        adText: '업계 최강 흡입력 200AW',
        findings: [
          finding({
            findingId: 'f-kr',
            summary: '최강 흡입력 200AW',
            decision: 'WARN',
            remediationType: 'EVIDENCE_SUPPLEMENT',
          }),
        ],
        pool: [],
      },
    );
    expect(attachPoolFile).not.toHaveBeenCalled();
    expect(opinions[0].kind).toBe('needs_substantiation');
  });
});
