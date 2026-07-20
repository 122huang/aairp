import type { FindingEvidenceLink, FinalDecision } from '@aairp/shared-kernel';
import { supportsEvidenceAttachment } from '@aairp/shared-kernel';
import type { CaseReportEvidenceLink, CaseReportFinding } from './case-report.model.js';

/**
 * Finding-level resolution for the effective_status path (WARN/REVIEW only).
 *
 * Only two values for now:
 * - OPEN — still needs action (rewrite, pending evidence, or manual-context gap)
 * - RESOLVED_BY_EVIDENCE — HUMAN_CONFIRMED + sufficient, or HUMAN_OVERRODE with reason
 *
 * No RESOLVED_BY_HUMAN: there is no real “no-file, human-only confirm” case yet
 * (e.g. EXTERNAL_STATUS without a certificate). Add that enum only when a trigger exists.
 *
 * REJECT 不参与 effective_status 流转 — hard-block findings stay on final_decision=REJECT
 * and are never evaluated as open/resolved here.
 */
export type FindingResolutionStatus = 'OPEN' | 'RESOLVED_BY_EVIDENCE';

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
 * Case-level effective status for user-facing conclusion (PASS/WARN/REVIEW only).
 * Does NOT mutate fusion `final_decision` (audit snapshot).
 *
 * REJECT 不参与 effective_status 流转 — see `applies: false` on the view.
 */
export type CaseEffectiveStatus = 'CLEARED' | 'OPEN_ISSUES';

export type CaseEffectiveStatusView = {
  /**
   * False when audit_final_decision is REJECT.
   * REJECT 不参与 effective_status 流转：不跑 finding 开闭判定，不可被证据“清关”。
   */
  applies: boolean;
  /** Null when `applies` is false (REJECT passthrough). */
  status: CaseEffectiveStatus | null;
  /** Visual tone for the conclusion card. */
  tone: 'pass' | 'resolved' | 'open' | 'blocked';
  /** Human-readable headline — no PASS/WARN/REVIEW/REJECT jargon. */
  headline: string;
  /** Short supporting lines (resolved items or remaining open items). */
  detail_lines: string[];
  /** Fusion audit decision kept for the dual-line audit row. */
  audit_final_decision: FinalDecision;
  /** Empty when REJECT (not evaluated). */
  finding_resolutions: FindingResolution[];
};

function isEffectiveStatusCandidate(decision: string): boolean {
  return decision === 'WARN' || decision === 'REVIEW';
}

function evidenceResolvesFinding(links: FindingEvidenceLink[]): boolean {
  for (const link of links) {
    if (link.status === 'HUMAN_CONFIRMED' && link.ai_judgment?.sufficiency === 'sufficient') {
      return true;
    }
    // Override accepts an attached evidence package with an explicit reason —
    // still RESOLVED_BY_EVIDENCE (not a separate RESOLVED_BY_HUMAN).
    if (link.status === 'HUMAN_OVERRODE' && link.override_reason?.trim()) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve WARN/REVIEW findings only. INFO / PASS / FAIL are omitted (not in this enum).
 * Non-evidence paths (REWRITE_ONLY, manual-context REVIEW) stay OPEN — gap hangs, no fake resolve.
 */
export function resolveFindingStatuses(
  findings: CaseReportFinding[],
  evidenceLinks: Array<FindingEvidenceLink | CaseReportEvidenceLink>,
): FindingResolution[] {
  const out: FindingResolution[] = [];

  for (const finding of findings) {
    if (!isEffectiveStatusCandidate(finding.decision)) continue;

    const base = {
      finding_id: finding.finding_id,
      ref_id: finding.ref_id,
      module: finding.module,
      decision: finding.decision,
      summary: finding.summary,
      remediation_type: finding.remediation_type,
    };

    const attachable = supportsEvidenceAttachment(finding.remediation_type, finding.decision);
    if (!attachable) {
      // Rewrite-only WARN or pure manual-context REVIEW: remain OPEN (do not pretend resolved).
      out.push({ ...base, status: 'OPEN' });
      continue;
    }

    const links = evidenceLinks.filter((link) => link.finding_id === finding.finding_id);
    if (evidenceResolvesFinding(links)) {
      const confirmed = links.find(
        (link) =>
          link.status === 'HUMAN_CONFIRMED' ||
          (link.status === 'HUMAN_OVERRODE' && link.override_reason?.trim()),
      );
      const title =
        confirmed && 'evidence' in confirmed && confirmed.evidence
          ? confirmed.evidence.title
          : undefined;
      out.push({
        ...base,
        status: 'RESOLVED_BY_EVIDENCE',
        ...(title ? { resolved_by_evidence_title: title } : {}),
      });
      continue;
    }

    out.push({ ...base, status: 'OPEN' });
  }

  return out;
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
 *
 * REJECT 不参与 effective_status 流转.
 */
export function deriveCaseEffectiveStatus(
  auditFinalDecision: FinalDecision,
  findings: CaseReportFinding[],
  evidenceLinks: Array<FindingEvidenceLink | CaseReportEvidenceLink>,
): CaseEffectiveStatusView {
  // REJECT 不参与 effective_status 流转 — hard intercept stays on final_decision.
  if (auditFinalDecision === 'REJECT') {
    const rejectSummaries = findings
      .filter((finding) => finding.decision === 'FAIL' || finding.decision === 'REJECT')
      .map((finding) => finding.summary);
    return {
      applies: false,
      status: null,
      tone: 'blocked',
      headline: '文案存在不能发布的问题，需要修改后重新提交',
      detail_lines: rejectSummaries.length
        ? rejectSummaries
        : ['存在阻断级风险，需修改后重新提交。'],
      audit_final_decision: auditFinalDecision,
      finding_resolutions: [],
    };
  }

  const finding_resolutions = resolveFindingStatuses(findings, evidenceLinks);
  const openIssues = finding_resolutions.filter((item) => item.status === 'OPEN');
  const resolvedEvidence = finding_resolutions.filter(
    (item) => item.status === 'RESOLVED_BY_EVIDENCE',
  );

  if (auditFinalDecision === 'PASS' && openIssues.length === 0) {
    return {
      applies: true,
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
      applies: true,
      status: 'CLEARED',
      tone: 'resolved',
      headline: '原本存在的问题已通过证据解决，可以进入下一步',
      detail_lines: resolvedEvidence.map(shortLabel),
      audit_final_decision: auditFinalDecision,
      finding_resolutions,
    };
  }

  // WARN/REVIEW with no open actionable findings (and nothing evidence-resolved to list).
  if (
    openIssues.length === 0 &&
    (auditFinalDecision === 'WARN' || auditFinalDecision === 'REVIEW')
  ) {
    return {
      applies: true,
      status: 'CLEARED',
      tone: 'pass',
      headline: '文案审核通过，可以进入下一步',
      detail_lines: [],
      audit_final_decision: auditFinalDecision,
      finding_resolutions,
    };
  }

  return {
    applies: true,
    status: 'OPEN_ISSUES',
    tone: 'open',
    headline: '存在需要处理的事项，暂不建议发布',
    detail_lines: openIssues.map((item) => item.summary),
    audit_final_decision: auditFinalDecision,
    finding_resolutions,
  };
}
