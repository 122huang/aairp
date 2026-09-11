import { describe, expect, it } from 'vitest';
import type { ReviewReportFindingSummary } from '@aairp/shared-kernel';
import { composeOverallDecision } from './overall-decision.js';

function finding(
  partial: Partial<ReviewReportFindingSummary> &
    Pick<ReviewReportFindingSummary, 'findingId' | 'summary'>,
): ReviewReportFindingSummary {
  return {
    module: 'RULE',
    refId: partial.refId ?? partial.findingId,
    severity: 'HIGH',
    decision: partial.decision ?? 'WARN',
    ...partial,
  };
}

describe('composeOverallDecision', () => {
  it('keeps REJECT even when materials would support a claim', () => {
    const view = composeOverallDecision({
      copyDecision: 'REJECT',
      findings: [
        finding({
          findingId: 'f-sg',
          summary: 'treats a cold',
          decision: 'REJECT',
          remediationType: 'REWRITE_ONLY',
        }),
      ],
      opinions: [
        {
          kind: 'prohibited',
          label: '不得使用',
          summary: '该表述本身不允许使用。',
          claim_anchor: 'treats a cold',
          finding_ids: ['f-sg'],
          ref_ids: ['f-sg'],
        },
      ],
    });
    expect(view.overall_decision).toBe('REJECT');
    expect(view.copy_decision).toBe('REJECT');
    expect(view.evidence_cleared).toBe(false);
  });

  it('does not pass when rewrite-only WARN remains', () => {
    const view = composeOverallDecision({
      copyDecision: 'WARN',
      findings: [
        finding({
          findingId: 'f-abs',
          summary: 'perfect',
          remediationType: 'REWRITE_ONLY',
        }),
        finding({
          findingId: 'f-perf',
          summary: '8 minutes',
          remediationType: 'EVIDENCE_SUPPLEMENT',
        }),
      ],
      opinions: [
        {
          kind: 'prohibited',
          label: '不得使用',
          summary: '该表述本身不允许使用。',
          claim_anchor: 'perfect',
          finding_ids: ['f-abs'],
          ref_ids: ['f-abs'],
        },
        {
          kind: 'substantiation_supports',
          label: '材料可支持',
          summary: '材料可支持该表述。',
          claim_anchor: '8 minutes',
          finding_ids: ['f-perf'],
          ref_ids: ['f-perf'],
        },
      ],
    });
    expect(view.overall_decision).toBe('WARN');
    expect(view.evidence_cleared).toBe(false);
  });

  it('passes overall when every open finding is substantiation-supported', () => {
    const view = composeOverallDecision({
      copyDecision: 'WARN',
      findings: [
        finding({
          findingId: 'f-perf',
          summary: '8 minutes',
          remediationType: 'EVIDENCE_SUPPLEMENT',
        }),
        finding({
          findingId: 'f-info',
          summary: 'disclosure',
          decision: 'INFO',
          remediationType: 'NOT_APPLICABLE_DISCLOSURE',
        }),
      ],
      opinions: [
        {
          kind: 'substantiation_supports',
          label: '材料可支持',
          summary: '材料可支持该表述。',
          claim_anchor: '8 minutes',
          finding_ids: ['f-perf'],
          ref_ids: ['f-perf'],
        },
      ],
    });
    expect(view.copy_decision).toBe('WARN');
    expect(view.overall_decision).toBe('PASS');
    expect(view.evidence_cleared).toBe(true);
  });

  it('keeps WARN when materials are insufficient', () => {
    const view = composeOverallDecision({
      copyDecision: 'WARN',
      findings: [
        finding({
          findingId: 'f-perf',
          summary: '200AW',
          remediationType: 'EVIDENCE_SUPPLEMENT',
        }),
      ],
      opinions: [
        {
          kind: 'substantiation_weak',
          label: '材料不足',
          summary: '已提交材料，但与该表述不符，或尚不充分。',
          claim_anchor: '200AW',
          finding_ids: ['f-perf'],
          ref_ids: ['f-perf'],
        },
      ],
    });
    expect(view.overall_decision).toBe('WARN');
    expect(view.evidence_cleared).toBe(false);
  });

  it('does not treat not-evaluated materials as evidence-cleared or as overall WARN', () => {
    const view = composeOverallDecision({
      copyDecision: 'PASS',
      findings: [],
      opinions: [
        {
          kind: 'evidence_not_evaluated',
          label: '材料未进入实证判断',
          summary: '附件未进入实证判断。',
          claim_anchor: 'manual',
          finding_ids: [],
          ref_ids: [],
        },
      ],
    });
    expect(view.copy_decision).toBe('PASS');
    expect(view.overall_decision).toBe('PASS');
    expect(view.evidence_cleared).toBe(false);
  });
});
