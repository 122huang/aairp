import type {
  CaseFinding,
  CasePrecedent,
  LlmFinding,
  OpenRiskDiscoveryResult,
  PlaybookFinding,
  ReviewContext,
  ReviewDecisionResult,
  ReviewReportFindingSummary,
  ReviewReportResult,
  RuleFinding,
} from '@aairp/shared-kernel';
import { confidenceBand } from './decision-engine.service.js';

export type ReviewReportConfig = {
  now?: () => Date;
  textPreviewLength?: number;
};

export type ReviewReportSources = {
  context: ReviewContext;
  decision: ReviewDecisionResult;
  ruleFindings: RuleFinding[];
  playbookFindings: PlaybookFinding[];
  openRiskResult: Pick<OpenRiskDiscoveryResult, 'findings' | 'skipped' | 'skipReason'>;
  casePrecedents?: CasePrecedent[];
  caseFindings?: CaseFinding[];
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTextPreview(text: string | undefined, maxLength: number): string {
  const normalized = (text ?? '').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function toFindingSummaries(
  ruleFindings: RuleFinding[],
  playbookFindings: PlaybookFinding[],
  llmFindings: LlmFinding[],
  caseFindings: CaseFinding[] = [],
): ReviewReportFindingSummary[] {
  return [
    ...ruleFindings.map((finding) => ({
      module: finding.module,
      refId: finding.refId,
      severity: finding.severity,
      decision: finding.decision,
      summary: finding.summary,
    })),
    ...caseFindings.map((finding) => ({
      module: finding.module,
      refId: finding.refId,
      severity: finding.severity,
      decision: finding.decision,
      summary: finding.summary,
    })),
    ...playbookFindings.map((finding) => ({
      module: finding.module,
      refId: finding.refId,
      severity: finding.severity,
      decision: finding.decision,
      summary: finding.summary,
    })),
    ...llmFindings.map((finding) => ({
      module: finding.module,
      refId: finding.refId,
      severity: finding.severity,
      decision: finding.decision,
      summary: finding.summary,
    })),
  ];
}

function decisionCssClass(finalDecision: ReviewDecisionResult['finalDecision']): string {
  switch (finalDecision) {
    case 'REJECT':
      return 'decision-reject';
    case 'WARN':
      return 'decision-warn';
    default:
      return 'decision-pass';
  }
}

function renderFindingSection(
  title: string,
  findings: ReviewReportFindingSummary[],
): string {
  if (findings.length === 0) {
    return `<h2>${escapeHtml(title)}</h2><p class="meta">No findings</p>`;
  }

  const rows = findings
    .map(
      (finding) =>
        `<tr>
          <td>${escapeHtml(finding.refId)}</td>
          <td>${escapeHtml(finding.severity)}</td>
          <td>${escapeHtml(finding.decision)}</td>
          <td>${escapeHtml(finding.summary)}</td>
        </tr>`,
    )
    .join('\n');

  return `<h2>${escapeHtml(title)}</h2>
  <table>
    <thead>
      <tr>
        <th>Ref ID</th>
        <th>Severity</th>
        <th>Decision</th>
        <th>Summary</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderPrecedentSection(precedents: CasePrecedent[]): string {
  if (precedents.length === 0) {
    return '';
  }

  const rows = precedents
    .map(
      (precedent) =>
        `<tr>
          <td>${escapeHtml(precedent.case_id)}</td>
          <td>${precedent.case_version}</td>
          <td>${escapeHtml(precedent.final_decision)}</td>
          <td>${precedent.similarity_score.toFixed(2)}</td>
          <td>${escapeHtml(precedent.match_reason)}</td>
          <td>${escapeHtml(precedent.summary)}</td>
        </tr>`,
    )
    .join('\n');

  return `<h2>Similar Case Precedents</h2>
  <p class="meta">Case-first retrieval (report only — does not affect decision).</p>
  <table>
    <thead>
      <tr>
        <th>Case ID</th>
        <th>Version</th>
        <th>Final Decision</th>
        <th>Similarity</th>
        <th>Match Reason</th>
        <th>Summary</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderReportHtml(
  sources: ReviewReportSources,
  findings: ReviewReportFindingSummary[],
  textPreview: string,
  generatedAt: string,
): string {
  const {
    context,
    decision,
    openRiskResult,
    ruleFindings,
    playbookFindings,
    casePrecedents = [],
  } = sources;
  const openRiskNote = openRiskResult.skipped
    ? `<p class="note"><strong>Open Risk:</strong> skipped (${escapeHtml(openRiskResult.skipReason ?? 'UNKNOWN')}) — deterministic blocker or policy path already decisive.</p>`
    : '';

  const ruleSummaries = findings.filter((finding) => finding.module === 'RULE');
  const caseSummaries = findings.filter((finding) => finding.module === 'CASE');
  const playbookSummaries = findings.filter((finding) => finding.module === 'PLAYBOOK');
  const llmSummaries = findings.filter((finding) => finding.module === 'LLM');
  const band = confidenceBand(decision.confidence);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Review Report ${escapeHtml(decision.reviewId)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; line-height: 1.5; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 14px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
    .decision { font-size: 22px; font-weight: bold; padding: 8px 12px; border-radius: 6px; display: inline-block; }
    .decision-pass { background: #e8f5e9; color: #1b5e20; }
    .decision-warn { background: #fff3e0; color: #e65100; }
    .decision-reject { background: #ffebee; color: #b71c1c; }
    .meta { color: #555; font-size: 14px; }
    .note { background: #f9f9f9; border-left: 4px solid #999; padding: 8px 12px; }
    .counts { margin-top: 8px; }
  </style>
</head>
<body>
  <h1>Advertising Review Report</h1>
  <p class="meta">Review ID: ${escapeHtml(decision.reviewId)}</p>
  <p class="meta">Advertisement ID: ${escapeHtml(context.advertisementId)}</p>
  <p class="meta">Generated at: ${escapeHtml(generatedAt)}</p>

  <h2>Decision</h2>
  <p class="decision ${decisionCssClass(decision.finalDecision)}">${escapeHtml(decision.finalDecision)}</p>
  <p><strong>Confidence:</strong> ${decision.confidence} (${escapeHtml(band)})</p>
  <p><strong>Rationale:</strong> ${escapeHtml(decision.rationale)}</p>
  <p class="counts"><strong>Finding counts:</strong> Rule ${ruleFindings.length}, Case ${caseSummaries.length}, Playbook ${playbookFindings.length}, LLM ${openRiskResult.findings.length}</p>
  ${openRiskNote}

  <h2>Advertisement</h2>
  <p><strong>Country:</strong> ${escapeHtml(context.dimensions.countryId)}</p>
  <p><strong>Platform:</strong> ${escapeHtml(context.dimensions.platformId)}</p>
  <p><strong>Category:</strong> ${escapeHtml(context.dimensions.categoryId)}</p>
  <p><strong>Text:</strong> ${escapeHtml(textPreview)}</p>

  ${renderFindingSection('Rule Findings', ruleSummaries)}
  ${renderFindingSection('Case Findings', caseSummaries)}
  ${renderFindingSection('Playbook Findings', playbookSummaries)}
  ${renderFindingSection('Open Risk (LLM) Findings', llmSummaries)}
  ${renderPrecedentSection(casePrecedents)}
</body>
</html>`;
}

export class ReviewReportService {
  constructor(private readonly config: ReviewReportConfig = {}) {}

  render(sources: ReviewReportSources): ReviewReportResult {
    const generatedAt = (this.config.now ?? (() => new Date()))().toISOString();
    const textPreviewLength = this.config.textPreviewLength ?? 240;
    const {
      context,
      decision,
      ruleFindings,
      playbookFindings,
      openRiskResult,
      casePrecedents = [],
      caseFindings = [],
    } = sources;
    const findings = toFindingSummaries(
      ruleFindings,
      playbookFindings,
      openRiskResult.findings,
      caseFindings,
    );

    const textPreview = buildTextPreview(context.normalizedContent.text, textPreviewLength);

    return {
      reviewId: decision.reviewId,
      advertisementId: context.advertisementId,
      reportHtml: renderReportHtml(sources, findings, textPreview, generatedAt),
      summary: {
        finalDecision: decision.finalDecision,
        confidence: decision.confidence,
        rationale: decision.rationale,
        findingCounts: { ...decision.findingCounts },
        advertisement: {
          textPreview,
          countryId: context.dimensions.countryId,
          platformId: context.dimensions.platformId,
          categoryId: context.dimensions.categoryId,
        },
        findings,
        openRiskSkipped: openRiskResult.skipped,
        openRiskSkipReason: openRiskResult.skipReason,
        ...(casePrecedents.length > 0 ? { casePrecedents } : {}),
      },
      generatedAt,
    };
  }
}
