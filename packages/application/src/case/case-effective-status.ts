import type { FindingEvidenceLink, FinalDecision } from '@aairp/shared-kernel';
import { supportsEvidenceAttachment } from '@aairp/shared-kernel';
import type { CaseReportEvidenceLink, CaseReportFinding } from './case-report.model.js';

/** Finding-level resolution relative to evidence / human confirmation. */
export type FindingResolutionStatus =
  | 'NOT_ACTIONABLE'
  | 'OPEN'
  | 'RESOLVED_BY_EVIDENCE'
  | 'OPEN_MANUAL';

export type FindingResolution = {
  finding_id: string;
  ref_id: string;
  module: CaseReportFinding['module'];
  decision: string;
  summary: string;
  remediation_type?: string;
  status: FindingResolutionStatus;
  /** Evidence title when resolved via confirmed link. */
  resolved_by_evidence_title?: string;
};

/**
 * Case-level effective status for user-facing conclusion.
 * Does NOT mutate fusion `final_decision` (audit snapshot).
 */
export type CaseEffectiveStatus = 'CLEARED' | 'OPEN_ISSUES' | 'BLOCKED';

export type CaseEffectiveStatusView = {
  status: CaseEffectiveStatus;
  /** Visual tone for the conclusion card. */
  tone: 'pass' | 'resolved' | 'open' | 'blocked';
  /** Human-readable headline — no PASS/WARN/REVIEW/REJECT jargon. */
  headline: string;
  /** Short supporting lines (resolved items or remaining open items). */
  detail_lines: string[];
  /** Fusion audit decision kept for details section. */
  audit_final_decision: FinalDecision;
  finding_resolutions: FindingResolution[];
};

function isActionableDecision(decision: string): boolean {
  return decision === 'WARN' || decision === 'REVIEW' || decision === 'FAIL';
}

function evidenceResolvesFinding(links: FindingEvidenceLink[]): {
  resolved: boolean;
  title?: string;
} {
  for (const link of links) {
    if (link.status === 'HUMAN_CONFIRMED') {
      if (link.ai_judgment?.sufficiency === 'sufficient') {
        return { resolved: true, title: undefined };
      }
    }
    // override_accept requires override_reason; treat as human acceptance of evidence.
    if (link.status === 'HUMAN_OVERRODE' && link.override_reason?.trim()) {
      return { resolved: true, title: undefined };
    }
  }
  return { resolved: false };
}

export function resolveFindingStatuses(
  findings: CaseReportFinding[],
  evidenceLinks: Array<FindingEvidenceLink | CaseReportEvidenceLink>,
): FindingResolution[] {
  return findings.map((finding) => {
    const base = {
      finding_id: finding.finding_id,
      ref_id: finding.ref_id,
      module: finding.module,
      decision: finding.decision,
      summary: finding.summary,
      remediation_type: finding.remediation_type,
    };

    if (!isActionableDecision(finding.decision)) {
      return { ...base, status: 'NOT_ACTIONABLE' as const };
    }

    const attachable = supportsEvidenceAttachment(finding.remediation_type, finding.decision);
    if (!attachable) {
      // WARN rewrite-only / manual REVIEW — no evidence-resolved path yet.
      if (finding.decision === 'REVIEW') {
        return { ...base, status: 'OPEN_MANUAL' as const };
      }
      // Non-evidence WARN (e.g. REWRITE_ONLY) still counts as open issue for effective status.
      return { ...base, status: 'OPEN' as const };
    }

    const links = evidenceLinks.filter((link) => link.finding_id === finding.finding_id);
    const { resolved } = evidenceResolvesFinding(links);
    if (resolved) {
      const confirmed = links.find(
        (link) =>
          link.status === 'HUMAN_CONFIRMED' ||
          (link.status === 'HUMAN_OVERRODE' && link.override_reason?.trim()),
      );
      const title =
        confirmed && 'evidence' in confirmed && confirmed.evidence
          ? confirmed.evidence.title
          : undefined;
      return {
        ...base,
        status: 'RESOLVED_BY_EVIDENCE' as const,
        ...(title ? { resolved_by_evidence_title: title } : {}),
      };
    }

    return { ...base, status: 'OPEN' as const };
  });
}

function shortLabel(resolution: FindingResolution): string {
  const title = resolution.resolved_by_evidence_title;
  if (resolution.status === 'RESOLVED_BY_EVIDENCE') {
    return title
      ? `${resolution.summary}——已通过「${title}」证据解决`
      : `${resolution.summary}——已通过证据解决`;
  }
  return resolution.summary;
}

/**
 * Derive case effective status from fusion audit decision + finding resolutions.
 * Fusion `final_decision` is never rewritten.
 */
export function deriveCaseEffectiveStatus(
  auditFinalDecision: FinalDecision,
  findings: CaseReportFinding[],
  evidenceLinks: Array<FindingEvidenceLink | CaseReportEvidenceLink>,
): CaseEffectiveStatusView {
  const finding_resolutions = resolveFindingStatuses(findings, evidenceLinks);
  const openIssues = finding_resolutions.filter(
    (item) => item.status === 'OPEN' || item.status === 'OPEN_MANUAL',
  );
  const resolvedEvidence = finding_resolutions.filter(
    (item) => item.status === 'RESOLVED_BY_EVIDENCE',
  );

  if (auditFinalDecision === 'REJECT') {
    return {
      status: 'BLOCKED',
      tone: 'blocked',
      headline: '文案存在不能发布的问题，需要修改后重新提交',
      detail_lines: openIssues.length
        ? openIssues.map((item) => item.summary)
        : ['存在阻断级风险，融合结论为拒绝发布。'],
      audit_final_decision: auditFinalDecision,
      finding_resolutions,
    };
  }

  if (auditFinalDecision === 'PASS' && openIssues.length === 0) {
    return {
      status: 'CLEARED',
      tone: 'pass',
      headline: '文案审核通过，可以进入下一步',
      detail_lines: [],
      audit_final_decision: auditFinalDecision,
      finding_resolutions,
    };
  }

  if (openIssues.length === 0 && resolvedEvidence.length > 0) {
    return {
      status: 'CLEARED',
      tone: 'resolved',
      headline: '原本存在的问题已通过证据解决，可以进入下一步',
      detail_lines: resolvedEvidence.map(shortLabel),
      audit_final_decision: auditFinalDecision,
      finding_resolutions,
    };
  }

  if (openIssues.length === 0) {
    // WARN/REVIEW with only non-actionable findings, or PASS with noise — treat as cleared-ish
    // but keep tone based on audit when nothing actionable remains.
    if (auditFinalDecision === 'PASS') {
      return {
        status: 'CLEARED',
        tone: 'pass',
        headline: '文案审核通过，可以进入下一步',
        detail_lines: [],
        audit_final_decision: auditFinalDecision,
        finding_resolutions,
      };
    }
  }

  return {
    status: 'OPEN_ISSUES',
    tone: 'open',
    headline: '存在需要处理的事项，暂不建议发布',
    detail_lines: openIssues.map((item) => item.summary),
    audit_final_decision: auditFinalDecision,
    finding_resolutions,
  };
}
