import {
  groupFindingsByClaimAnchor,
  supportsEvidenceAttachment,
  type ClaimOpinion,
  type ClaimOpinionEvidenceView,
  type ClaimOpinionKind,
  type FindingEvidenceLink,
  type ReviewReportFindingSummary,
} from '@aairp/shared-kernel';

/** Narrow link shape used when composing opinions (store record or report view). */
export type ClaimOpinionLinkInput = {
  finding_id: string;
  evidence_id: string;
  ai_judgment?: FindingEvidenceLink['ai_judgment'];
  evidence: {
    title: string;
    file: { filename: string };
  };
};

const LABELS: Record<ClaimOpinionKind, { label: string; summary: (anchor: string) => string }> = {
  prohibited: {
    label: '不得使用',
    summary: () =>
      '该表述本身不允许使用。所附材料不能改变这一结论。',
  },
  needs_substantiation: {
    label: '须有依据',
    summary: () => '该表述可以使用，但须有依据。本次未提交支撑材料。',
  },
  substantiation_weak: {
    label: '材料不足',
    summary: () => '已提交材料，但与该表述不符，或尚不充分。',
  },
  substantiation_supports: {
    label: '材料可支持',
    summary: () => '材料可支持该表述。',
  },
  copy_only: {
    label: '提示事项',
    summary: () => '提示事项（如披露、语境），与检测报告无关。',
  },
  unused_evidence: {
    label: '材料未使用',
    summary: () => '下列材料未用于本次判断：与上述表述无关。',
  },
  evidence_not_evaluated: {
    label: '材料未进入实证判断',
    summary: () =>
      '本次文案未识别到需要材料佐证的风险宣称，因此所附材料未进入相关性及充分性判断。',
  },
};

function toAnchorSource(finding: ReviewReportFindingSummary) {
  return {
    finding_id: finding.findingId,
    summary: finding.summary,
    evidence_spans: finding.evidenceSpans,
    rewrite_suggestions: finding.rewriteSuggestions?.map((suggestion) => ({
      original_span: suggestion.originalSpan,
    })),
  };
}

function quoteOf(finding: ReviewReportFindingSummary): string | undefined {
  return finding.evidenceSpans?.[0]?.text?.trim() || finding.summary?.trim() || undefined;
}

function judgmentSupports(link: ClaimOpinionLinkInput): boolean {
  const judgment = link.ai_judgment;
  if (!judgment) return false;
  return judgment.relevance !== 'none' && judgment.sufficiency === 'sufficient';
}

function toEvidenceView(link: ClaimOpinionLinkInput): ClaimOpinionEvidenceView {
  const judgment = link.ai_judgment;
  return {
    evidence_id: link.evidence_id,
    title: link.evidence.title,
    filename: link.evidence.file.filename,
    ...(judgment?.relevance ? { relevance: judgment.relevance } : {}),
    ...(judgment?.sufficiency ? { sufficiency: judgment.sufficiency } : {}),
    ...(judgment?.extracted_key_facts ? { excerpt: judgment.extracted_key_facts } : {}),
    ...(judgment?.relevance_reasoning
      ? { relevance_reasoning: judgment.relevance_reasoning }
      : {}),
    ...(judgment?.sufficiency_reasoning
      ? { sufficiency_reasoning: judgment.sufficiency_reasoning }
      : {}),
    ...(judgment?.text_unreadable ? { text_unreadable: true } : {}),
  };
}

function kindForGroup(
  findings: ReviewReportFindingSummary[],
  links: ClaimOpinionLinkInput[],
  poolFileCount: number,
): ClaimOpinionKind {
  if (findings.some((finding) => finding.remediationType === 'REWRITE_ONLY')) {
    return 'prohibited';
  }
  const attachable = findings.filter((finding) =>
    supportsEvidenceAttachment(finding.remediationType, finding.decision),
  );
  if (attachable.length === 0) {
    return 'copy_only';
  }
  const findingIds = new Set(attachable.map((finding) => finding.findingId));
  const groupLinks = links.filter((link) => findingIds.has(link.finding_id));
  if (groupLinks.some(judgmentSupports)) {
    return 'substantiation_supports';
  }
  if (poolFileCount > 0) {
    return 'substantiation_weak';
  }
  return 'needs_substantiation';
}

function unusedEvidenceOpinions(links: ClaimOpinionLinkInput[]): ClaimOpinion[] {
  const byEvidence = new Map<string, ClaimOpinionLinkInput[]>();
  for (const link of links) {
    const list = byEvidence.get(link.evidence_id) ?? [];
    list.push(link);
    byEvidence.set(link.evidence_id, list);
  }

  const unused: ClaimOpinion[] = [];
  for (const group of byEvidence.values()) {
    const used = group.some(
      (link) => link.ai_judgment && link.ai_judgment.relevance !== 'none',
    );
    if (used) continue;
    const sample = group[0];
    const copy = LABELS.unused_evidence;
    unused.push({
      kind: 'unused_evidence',
      label: copy.label,
      summary: `${copy.summary(sample.evidence.title)}（${sample.evidence.file.filename}）`,
      claim_anchor: sample.evidence.title,
      finding_ids: [],
      ref_ids: [],
      evidence: [toEvidenceView(sample)],
    });
  }
  return unused;
}

/** Files submitted but never linked (no attachable findings) — not judged, not unrelated. */
function unlinkedPoolOpinions(
  poolTitles: Array<{ title: string; filename: string }>,
): ClaimOpinion[] {
  return poolTitles.map((file) => {
    const copy = LABELS.evidence_not_evaluated;
    return {
      kind: 'evidence_not_evaluated' as const,
      label: copy.label,
      summary: `${copy.summary(file.title)}（${file.filename}）`,
      claim_anchor: file.title,
      finding_ids: [],
      ref_ids: [],
    };
  });
}

export function composeClaimOpinions(input: {
  findings: ReviewReportFindingSummary[];
  links: ClaimOpinionLinkInput[];
  poolFileCount: number;
  poolFiles?: Array<{ title: string; filename: string }>;
}): ClaimOpinion[] {
  const groups = groupFindingsByClaimAnchor(input.findings.map(toAnchorSource));
  const findingById = new Map(input.findings.map((finding) => [finding.findingId, finding]));
  const opinions: ClaimOpinion[] = [];

  for (const group of groups) {
    const findings = group.findings
      .map((source) => findingById.get(source.finding_id))
      .filter((finding): finding is ReviewReportFindingSummary => Boolean(finding));
    if (findings.length === 0) continue;

    const kind = kindForGroup(findings, input.links, input.poolFileCount);
    const copy = LABELS[kind];
    const findingIds = findings.map((finding) => finding.findingId);
    const idSet = new Set(findingIds);
    const groupLinks = input.links.filter((link) => idSet.has(link.finding_id));
    const evidenceViews = dedupeEvidenceViews(groupLinks.map(toEvidenceView));
    const primary = findings[0];

    opinions.push({
      kind,
      label: copy.label,
      summary: copy.summary(group.claimAnchor),
      claim_anchor: group.claimAnchor,
      finding_ids: findingIds,
      ref_ids: [...new Set(findings.map((finding) => finding.refId))],
      ...(quoteOf(primary) ? { quote: quoteOf(primary) } : {}),
      ...(evidenceViews.length > 0 ? { evidence: evidenceViews } : {}),
    });
  }

  opinions.push(...unusedEvidenceOpinions(input.links));
  if (input.links.length === 0 && (input.poolFiles?.length ?? 0) > 0) {
    opinions.push(
      ...unlinkedPoolOpinions(input.poolFiles ?? []),
    );
  }
  return opinions;
}

function dedupeEvidenceViews(views: ClaimOpinionEvidenceView[]): ClaimOpinionEvidenceView[] {
  const seen = new Set<string>();
  const out: ClaimOpinionEvidenceView[] = [];
  for (const view of views) {
    if (seen.has(view.evidence_id)) continue;
    seen.add(view.evidence_id);
    out.push(view);
  }
  return out;
}
