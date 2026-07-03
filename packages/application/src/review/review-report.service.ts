import type {
  CaseFinding,
  CasePrecedent,
  ContextualRewriteBatchResult,
  LlmFinding,
  OpenRiskDiscoveryResult,
  PlaybookFinding,
  ReviewContext,
  ReviewDecisionResult,
  ReviewReportFindingSummary,
  ReviewReportResult,
  RewriteSuggestion,
  RuleFinding,
  VisionFinding,
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
  visionFindings?: VisionFinding[];
  casePrecedents?: CasePrecedent[];
  caseFindings?: CaseFinding[];
  contextualRewrites?: ContextualRewriteBatchResult;
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

function mapFindingEvidenceSpans(
  finding: RuleFinding | PlaybookFinding | LlmFinding | CaseFinding | VisionFinding,
): ReviewReportFindingSummary['evidenceSpans'] {
  if (finding.module === 'LLM') {
    return finding.evaluationDetail?.evidenceSpans;
  }
  if (finding.module === 'VISION') {
    return finding.evaluationDetail?.evidenceSpans
      ?.filter((span) => span.text?.trim())
      .map((span) => ({
        field: span.field,
        start: span.start,
        end: span.end,
        text: span.text!,
      }));
  }
  return finding.evaluationDetail?.matchedSpans;
}

function toFindingSummary(
  finding: RuleFinding | PlaybookFinding | LlmFinding | CaseFinding | VisionFinding,
): ReviewReportFindingSummary {
  const evidenceSpans = mapFindingEvidenceSpans(finding);
  return {
    findingId: finding.findingId,
    module: finding.module,
    refId: finding.refId,
    severity: finding.severity,
    decision: finding.decision,
    summary: finding.summary,
    ...(evidenceSpans?.length ? { evidenceSpans } : {}),
  };
}

function toFindingSummaries(
  ruleFindings: RuleFinding[],
  playbookFindings: PlaybookFinding[],
  llmFindings: LlmFinding[],
  caseFindings: CaseFinding[] = [],
  visionFindings: VisionFinding[] = [],
): ReviewReportFindingSummary[] {
  return [
    ...ruleFindings.map(toFindingSummary),
    ...caseFindings.map(toFindingSummary),
    ...playbookFindings.map(toFindingSummary),
    ...llmFindings.map(toFindingSummary),
    ...visionFindings.map(toFindingSummary),
  ];
}

function attachRewriteSuggestions(
  findings: ReviewReportFindingSummary[],
  contextualRewrites?: ContextualRewriteBatchResult,
): ReviewReportFindingSummary[] {
  if (!contextualRewrites) {
    return findings;
  }

  const suggestionsByFindingId = new Map<string, RewriteSuggestion>();
  for (const result of contextualRewrites.results) {
    if (!result.skipped && result.suggestion) {
      suggestionsByFindingId.set(result.findingId, result.suggestion);
    }
  }

  if (suggestionsByFindingId.size === 0) {
    return findings;
  }

  return findings.map((finding) => {
    const suggestion = suggestionsByFindingId.get(finding.findingId);
    if (!suggestion) {
      return finding;
    }
    return {
      ...finding,
      rewriteSuggestions: [suggestion],
    };
  });
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

function isWarnLikeDecision(decision: string): boolean {
  return decision === 'WARN' || decision === 'REVIEW' || decision === 'CONDITIONAL';
}

function renderRewriteSuggestionsBlock(suggestion: RewriteSuggestion): string {
  const variants = suggestion.suggestedText
    .map(
      (text, index) =>
        `<li><span class="rewrite-variant-label">方案 ${index + 1}</span> ${escapeHtml(text)}</li>`,
    )
    .join('\n');

  return `<div class="rewrite-suggestions">
    <h4>修改建议</h4>
    <p class="meta"><strong>模板:</strong> ${escapeHtml(suggestion.rewriteTemplateId)} · <strong>风险类型:</strong> ${escapeHtml(suggestion.riskType)} · <strong>置信度:</strong> ${suggestion.confidence}</p>
    <p><strong>触发原文:</strong> ${escapeHtml(suggestion.originalSpan.text)}</p>
    <p>${escapeHtml(suggestion.rationale)}</p>
    <ol class="rewrite-variants">${variants}</ol>
  </div>`;
}

function renderFindingDetail(finding: ReviewReportFindingSummary): string {
  const rewriteBlock =
    isWarnLikeDecision(finding.decision) && finding.rewriteSuggestions?.length
      ? finding.rewriteSuggestions.map(renderRewriteSuggestionsBlock).join('\n')
      : '';

  return `<article class="finding-detail">
    <header class="finding-header">
      <span class="finding-ref">${escapeHtml(finding.refId)}</span>
      <span class="finding-severity">${escapeHtml(finding.severity)}</span>
      <span class="finding-decision">${escapeHtml(finding.decision)}</span>
    </header>
    <p class="finding-summary">${escapeHtml(finding.summary)}</p>
    ${rewriteBlock}
  </article>`;
}

function renderFindingSection(
  title: string,
  findings: ReviewReportFindingSummary[],
): string {
  if (findings.length === 0) {
    return `<h2>${escapeHtml(title)}</h2><p class="meta">No findings</p>`;
  }

  const items = findings.map(renderFindingDetail).join('\n');
  return `<h2>${escapeHtml(title)}</h2>
  <div class="finding-list">${items}</div>`;
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
  const visionSummaries = findings.filter((finding) => finding.module === 'VISION');
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
    h4 { font-size: 14px; margin: 12px 0 6px; color: #1565c0; }
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
    .finding-list { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
    .finding-detail { border: 1px solid #ddd; border-radius: 6px; padding: 12px; background: #fafafa; }
    .finding-header { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; font-size: 13px; }
    .finding-ref { font-weight: bold; }
    .finding-severity, .finding-decision { background: #eee; border-radius: 4px; padding: 2px 8px; }
    .finding-summary { margin: 0 0 4px; }
    .rewrite-suggestions { margin-top: 10px; padding: 10px 12px; background: #e3f2fd; border-left: 4px solid #1976d2; border-radius: 4px; }
    .rewrite-variants { margin: 8px 0 0 18px; padding: 0; }
    .rewrite-variant-label { font-weight: bold; margin-right: 6px; }
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
  <p class="counts"><strong>Finding counts:</strong> Rule ${ruleFindings.length}, Case ${caseSummaries.length}, Playbook ${playbookFindings.length}, LLM ${openRiskResult.findings.length}, Vision ${visionSummaries.length}</p>
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
  ${renderFindingSection('Vision Findings', visionSummaries)}
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
      visionFindings = [],
      casePrecedents = [],
      caseFindings = [],
      contextualRewrites,
    } = sources;
    const findings = attachRewriteSuggestions(
      toFindingSummaries(
        ruleFindings,
        playbookFindings,
        openRiskResult.findings,
        caseFindings,
        visionFindings,
      ),
      contextualRewrites,
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
