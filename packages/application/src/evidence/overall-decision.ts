import {
  supportsEvidenceAttachment,
  type ClaimOpinion,
  type FinalDecision,
  type ReviewReportFindingSummary,
} from '@aairp/shared-kernel';

const OPEN_DECISIONS = new Set(['WARN', 'REVIEW', 'FAIL', 'REJECT', 'CONDITIONAL']);

export type OverallDecisionView = {
  /** User-facing conclusion after overlaying material judgment. */
  overall_decision: FinalDecision;
  /** Copy-layer fusion snapshot. Never rewritten by materials. */
  copy_decision: FinalDecision;
  /** True when overall PASS is because materials covered every open substantiation finding. */
  evidence_cleared: boolean;
};

function asFinalDecision(value: string): FinalDecision {
  if (value === 'PASS' || value === 'WARN' || value === 'REJECT' || value === 'REVIEW') {
    return value;
  }
  return 'WARN';
}

function isOpenFinding(finding: ReviewReportFindingSummary): boolean {
  return OPEN_DECISIONS.has(finding.decision);
}

function opinionSupportsFinding(opinions: ClaimOpinion[], findingId: string): boolean {
  return opinions.some(
    (opinion) =>
      opinion.kind === 'substantiation_supports' && opinion.finding_ids.includes(findingId),
  );
}

/**
 * Compose the displayed overall decision from copy-layer fusion + claim opinions.
 *
 * Materials are assumed authentic. They may complete the review (overall PASS)
 * only when every open finding is evidence-attachable and 材料可支持.
 * Fusion `copy_decision` is unchanged. REJECT / 不得使用 / rewrite-only stay blocked.
 */
export function composeOverallDecision(input: {
  copyDecision: string;
  findings: ReviewReportFindingSummary[];
  opinions: ClaimOpinion[];
}): OverallDecisionView {
  const copy_decision = asFinalDecision(input.copyDecision);

  if (copy_decision === 'REJECT') {
    return { overall_decision: 'REJECT', copy_decision, evidence_cleared: false };
  }

  if (copy_decision === 'PASS') {
    return { overall_decision: 'PASS', copy_decision, evidence_cleared: false };
  }

  const openFindings = input.findings.filter(isOpenFinding);
  if (openFindings.length === 0) {
    return { overall_decision: copy_decision, copy_decision, evidence_cleared: false };
  }

  if (input.opinions.some((opinion) => opinion.kind === 'prohibited')) {
    return { overall_decision: copy_decision, copy_decision, evidence_cleared: false };
  }

  const allSupported = openFindings.every((finding) => {
    if (!supportsEvidenceAttachment(finding.remediationType, finding.decision)) {
      return false;
    }
    return opinionSupportsFinding(input.opinions, finding.findingId);
  });

  if (!allSupported) {
    return { overall_decision: copy_decision, copy_decision, evidence_cleared: false };
  }

  return { overall_decision: 'PASS', copy_decision, evidence_cleared: true };
}
