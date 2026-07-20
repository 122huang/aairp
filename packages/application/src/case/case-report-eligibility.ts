import type { CaseMatchedFinding, CaseRecord, FindingEvidenceLink } from '@aairp/shared-kernel';
import { supportsEvidenceAttachment } from '@aairp/shared-kernel';
import type { BusinessHandoffEligibility, CaseReportFinding } from './case-report.model.js';

export function collectCaseFindings(caseRecord: CaseRecord): CaseReportFinding[] {
  const mapped = (findings: CaseMatchedFinding[], module: CaseReportFinding['module']) =>
    findings.map((finding) => ({ ...finding, module }));

  return [
    ...mapped(caseRecord.matched_rules, 'RULE'),
    ...mapped(caseRecord.matched_playbooks, 'PLAYBOOK'),
    ...mapped(caseRecord.llm_analysis.findings, 'LLM'),
    ...mapped(caseRecord.vision_analysis?.findings ?? [], 'VISION'),
  ];
}

export function filterBusinessHandoffFindings(findings: CaseReportFinding[]): CaseReportFinding[] {
  return findings.filter((finding) => {
    const type = finding.remediation_type;
    return type === 'EXTERNAL_STATUS_VERIFICATION' || type === 'NOT_APPLICABLE_DISCLOSURE';
  });
}

function findingLabel(finding: CaseMatchedFinding): string {
  return `${finding.ref_id} (${finding.finding_id})`;
}

/**
 * Template A export gate.
 *
 * Allow: PASS / WARN; or REVIEW only when every REVIEW finding is evidence-attachable
 * and has at least one link at HUMAN_CONFIRMED or HUMAN_OVERRODE.
 *
 * Deny: REJECT; or REVIEW with pure manual/context findings (no handled status exists).
 * Case-level lifecycle CONFIRMED is intentionally not used.
 */
export function evaluateBusinessHandoffEligibility(
  caseRecord: CaseRecord,
  evidenceLinks: FindingEvidenceLink[],
): BusinessHandoffEligibility {
  const finalDecision = caseRecord.decision.final_decision;

  if (finalDecision === 'PASS' || finalDecision === 'WARN') {
    return { eligible: true };
  }

  if (finalDecision === 'REJECT') {
    return {
      eligible: false,
      code: 'REJECT_UNRESOLVED',
      reasons: ['最终结论为 REJECT，业务提醒摘要不允许导出未解决的拒绝结论。'],
    };
  }

  // REVIEW
  const reviewFindings = collectCaseFindings(caseRecord).filter(
    (finding) => finding.decision === 'REVIEW',
  );

  if (reviewFindings.length === 0) {
    return {
      eligible: false,
      code: 'REVIEW_NO_FINDINGS',
      reasons: ['最终结论为 REVIEW，但案例中未找到 decision=REVIEW 的 finding，无法判断是否已处理。'],
    };
  }

  const reasons: string[] = [];
  let hasManualContext = false;

  for (const finding of reviewFindings) {
    const attachable = supportsEvidenceAttachment(finding.remediation_type, finding.decision);
    if (!attachable) {
      hasManualContext = true;
      reasons.push(
        `${findingLabel(finding)} 属于纯人工语境判断类（remediation=${finding.remediation_type ?? 'unset'}），系统没有可查的「已处理」状态。`,
      );
      continue;
    }

    const resolved = evidenceLinks.some(
      (link) =>
        link.finding_id === finding.finding_id &&
        (link.status === 'HUMAN_CONFIRMED' || link.status === 'HUMAN_OVERRODE'),
    );
    if (!resolved) {
      reasons.push(
        `${findingLabel(finding)} 可走证据流程，但尚未到达 HUMAN_CONFIRMED / HUMAN_OVERRODE。`,
      );
    }
  }

  if (reasons.length === 0) {
    return { eligible: true };
  }

  return {
    eligible: false,
    code: hasManualContext ? 'REVIEW_MANUAL_CONTEXT' : 'REVIEW_EVIDENCE_INCOMPLETE',
    reasons,
  };
}
