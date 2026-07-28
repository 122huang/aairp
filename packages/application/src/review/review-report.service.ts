import {
  resolveFindingRemediationType,
  type CaseFinding,
  type CasePrecedent,
  type ConsistencyFinding,
  type ContextualRewriteBatchResult,
  type FinalDecision,
  type LlmFinding,
  type OpenRiskDiscoveryResult,
  type PlaybookFinding,
  type ReviewContext,
  type ReviewDecisionResult,
  type ReviewReportFindingSummary,
  type ReviewReportResult,
  type RewriteSuggestion,
  type RuleFinding,
  type VisionFinding,
} from '@aairp/shared-kernel';
import { readEntryModeFromTags } from './image-review-entry.js';

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
  consistencyFindings?: ConsistencyFinding[];
  visionMode?: 'off' | 'stub' | 'live';
  sliceThumbnails?: Record<string, string>;
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
  finding: RuleFinding | PlaybookFinding | LlmFinding | CaseFinding | VisionFinding | ConsistencyFinding,
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
  finding: RuleFinding | PlaybookFinding | LlmFinding | CaseFinding | VisionFinding | ConsistencyFinding,
): ReviewReportFindingSummary {
  const evidenceSpans = mapFindingEvidenceSpans(finding);
  const ruleRemediation =
    finding.module === 'RULE' ? (finding as RuleFinding).remediationType : undefined;
  const detail = finding.evaluationDetail as
    | { riskType?: string; patternId?: string }
    | undefined;
  const riskType = detail?.riskType ?? detail?.patternId;
  const remediationType = resolveFindingRemediationType({
    remediationType: ruleRemediation,
    riskType,
    refId: finding.refId,
  });
  return {
    findingId: finding.findingId,
    module: finding.module,
    refId: finding.refId,
    severity: finding.severity,
    decision: finding.decision,
    summary: finding.summary,
    ...(remediationType ? { remediationType } : {}),
    ...(evidenceSpans?.length ? { evidenceSpans } : {}),
  };
}

function toFindingSummaries(
  ruleFindings: RuleFinding[],
  playbookFindings: PlaybookFinding[],
  llmFindings: LlmFinding[],
  caseFindings: CaseFinding[] = [],
  visionFindings: VisionFinding[] = [],
  consistencyFindings: ConsistencyFinding[] = [],
): ReviewReportFindingSummary[] {
  return [
    ...ruleFindings.map(toFindingSummary),
    ...caseFindings.map(toFindingSummary),
    ...playbookFindings.map(toFindingSummary),
    ...llmFindings.map(toFindingSummary),
    ...visionFindings.map(toFindingSummary),
    ...consistencyFindings.map(toFindingSummary),
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
    case 'REVIEW':
      return 'decision-review';
    default:
      return 'decision-pass';
  }
}

function branchChipClass(decision: FinalDecision): string {
  switch (decision) {
    case 'REJECT':
      return 'branch-reject';
    case 'WARN':
      return 'branch-warn';
    case 'REVIEW':
      return 'branch-review';
    default:
      return 'branch-pass';
  }
}

function isWarnLikeDecision(decision: string): boolean {
  return decision === 'WARN' || decision === 'REVIEW' || decision === 'CONDITIONAL';
}

function resolveSliceThumbnail(
  finding: VisionFinding | ConsistencyFinding,
  sliceThumbnails?: Record<string, string>,
): string | undefined {
  if (!sliceThumbnails) {
    return undefined;
  }
  if (finding.module === 'VISION' && finding.sliceId) {
    return sliceThumbnails[finding.sliceId];
  }
  if (finding.module === 'CONSISTENCY') {
    const firstSlice = finding.evaluationDetail.slicesInvolved[0];
    if (firstSlice) {
      return sliceThumbnails[firstSlice];
    }
  }
  return undefined;
}

function renderSliceThumbnail(thumbnail?: string): string {
  if (!thumbnail) {
    return '';
  }
  return `<img class="slice-thumb" src="${escapeHtml(thumbnail)}" alt="slice" />`;
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

function renderFindingDetail(
  finding: ReviewReportFindingSummary,
  options?: {
    sliceThumbnails?: Record<string, string>;
    visionFindings?: VisionFinding[];
    consistencyFindings?: ConsistencyFinding[];
  },
): string {
  const rewriteBlock =
    isWarnLikeDecision(finding.decision) && finding.rewriteSuggestions?.length
      ? finding.rewriteSuggestions.map(renderRewriteSuggestionsBlock).join('\n')
      : '';

  let thumbnailBlock = '';
  if (finding.module === 'VISION') {
    const visionFinding = options?.visionFindings?.find((item) => item.findingId === finding.findingId);
    if (visionFinding) {
      thumbnailBlock = renderSliceThumbnail(
        resolveSliceThumbnail(visionFinding, options?.sliceThumbnails),
      );
    }
  } else if (finding.module === 'CONSISTENCY') {
    const consistencyFinding = options?.consistencyFindings?.find(
      (item) => item.findingId === finding.findingId,
    );
    if (consistencyFinding) {
      thumbnailBlock = renderSliceThumbnail(
        resolveSliceThumbnail(consistencyFinding, options?.sliceThumbnails),
      );
    }
  }

  return `<article class="finding-detail">
    <header class="finding-header">
      <span class="finding-ref">${escapeHtml(finding.refId)}</span>
      <span class="finding-severity">${escapeHtml(finding.severity)}</span>
      <span class="finding-decision">${escapeHtml(finding.decision)}</span>
    </header>
    ${thumbnailBlock}
    <p class="finding-summary">${escapeHtml(finding.summary)}</p>
    ${rewriteBlock}
  </article>`;
}

function renderFindingSection(
  title: string,
  findings: ReviewReportFindingSummary[],
  options?: {
    sliceThumbnails?: Record<string, string>;
    visionFindings?: VisionFinding[];
    consistencyFindings?: ConsistencyFinding[];
  },
): string {
  if (findings.length === 0) {
    return `<h2>${escapeHtml(title)}</h2><p class="meta">No findings</p>`;
  }

  const items = findings
    .map((finding) => renderFindingDetail(finding, options))
    .join('\n');
  return `<h2>${escapeHtml(title)}</h2>
  <div class="finding-list">${items}</div>`;
}

function renderBranchVerdictChips(branchVerdicts?: ReviewDecisionResult['branchVerdicts']): string {
  if (!branchVerdicts) {
    return '';
  }

  return `<div class="branch-verdicts">
    <span class="branch-chip ${branchChipClass(branchVerdicts.text)}">文案 ${escapeHtml(branchVerdicts.text)}</span>
    <span class="branch-chip ${branchChipClass(branchVerdicts.image)}">图片 ${escapeHtml(branchVerdicts.image)}</span>
    <span class="branch-chip ${branchChipClass(branchVerdicts.consistency)}">一致性 ${escapeHtml(branchVerdicts.consistency)}</span>
  </div>`;
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
    visionFindings = [],
    consistencyFindings = [],
    visionMode,
    sliceThumbnails,
    casePrecedents = [],
  } = sources;
  const openRiskNote = openRiskResult.skipped
    ? `<p class="note"><strong>Open Risk:</strong> skipped (${escapeHtml(openRiskResult.skipReason ?? 'UNKNOWN')}) — deterministic blocker or policy path already decisive.</p>`
    : '';
  const visionModeLine = visionMode
    ? `<p class="meta"><strong>Vision mode:</strong> ${escapeHtml(visionMode)}</p>`
    : '';
  const entryMode = readEntryModeFromTags(context.tags);
  const entryModeNote =
    entryMode === 'image'
      ? `<p class="note"><strong>Entry:</strong> Image review — text below is human-confirmed extract / OCR-aligned copy from the uploaded image (not a separate marketing draft).</p>`
      : '';
  const textLabel = entryMode === 'image' ? 'Text (confirmed extract)' : 'Text';

  const ruleSummaries = findings.filter((finding) => finding.module === 'RULE');
  const caseSummaries = findings.filter((finding) => finding.module === 'CASE');
  const playbookSummaries = findings.filter((finding) => finding.module === 'PLAYBOOK');
  const llmSummaries = findings.filter((finding) => finding.module === 'LLM');
  const visionSummaries = findings.filter((finding) => finding.module === 'VISION');
  const consistencySummaries = findings.filter((finding) => finding.module === 'CONSISTENCY');
  const consistencyCount = decision.findingCounts.consistency ?? consistencySummaries.length;

  const findingOptions = { sliceThumbnails, visionFindings, consistencyFindings };

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
    .decision-review { background: #e3f2fd; color: #0d47a1; }
    .decision-reject { background: #ffebee; color: #b71c1c; }
    .branch-verdicts { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .branch-chip { border-radius: 999px; padding: 4px 12px; font-size: 13px; font-weight: bold; }
    .branch-pass { background: #e8f5e9; color: #1b5e20; }
    .branch-warn { background: #fff3e0; color: #e65100; }
    .branch-review { background: #e3f2fd; color: #0d47a1; }
    .branch-reject { background: #ffebee; color: #b71c1c; }
    .meta { color: #555; font-size: 14px; }
    .note { background: #f9f9f9; border-left: 4px solid #999; padding: 8px 12px; }
    .counts { margin-top: 8px; }
    .finding-list { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
    .finding-detail { border: 1px solid #ddd; border-radius: 6px; padding: 12px; background: #fafafa; }
    .finding-header { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; font-size: 13px; }
    .finding-ref { font-weight: bold; }
    .finding-severity, .finding-decision { background: #eee; border-radius: 4px; padding: 2px 8px; }
    .finding-summary { margin: 0 0 4px; }
    .slice-thumb { display: block; max-height: 120px; width: auto; margin: 8px 0; border: 1px solid #ccc; border-radius: 4px; }
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
  ${renderBranchVerdictChips(decision.branchVerdicts)}
  <p><strong>Rationale:</strong> ${escapeHtml(decision.rationale)}</p>
  <p class="counts"><strong>Finding counts:</strong> Rule ${ruleFindings.length}, Case ${caseSummaries.length}, Playbook ${playbookFindings.length}, LLM ${openRiskResult.findings.length}, Vision ${visionSummaries.length}, Consistency ${consistencyCount}</p>
  ${visionModeLine}
  ${entryModeNote}
  ${openRiskNote}

  <h2>Advertisement</h2>
  <p><strong>Country:</strong> ${escapeHtml(context.dimensions.countryId)}</p>
  <p><strong>Platform:</strong> ${escapeHtml(context.dimensions.platformId)}</p>
  <p><strong>Category:</strong> ${escapeHtml(context.dimensions.categoryId)}</p>
  <p><strong>${textLabel}:</strong> ${escapeHtml(textPreview)}</p>

  ${renderFindingSection('Rule Findings', ruleSummaries, findingOptions)}
  ${renderFindingSection('Case Findings', caseSummaries, findingOptions)}
  ${renderFindingSection('Playbook Findings', playbookSummaries, findingOptions)}
  ${renderFindingSection('Open Risk (LLM) Findings', llmSummaries, findingOptions)}
  ${renderFindingSection('Vision Findings', visionSummaries, findingOptions)}
  ${renderFindingSection('Consistency Findings', consistencySummaries, findingOptions)}
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
      consistencyFindings = [],
      visionMode,
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
        consistencyFindings,
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
        ...(decision.branchVerdicts ? { branchVerdicts: decision.branchVerdicts } : {}),
        ...(visionMode ? { visionMode } : {}),
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

