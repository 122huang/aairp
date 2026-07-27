/** Minimal finding shape needed to group evidence-upload cards by claim fragment. */
export type ClaimAnchorSource = {
  finding_id: string;
  summary?: string;
  evidence_spans?: Array<{ text?: string }>;
  rewrite_suggestions?: Array<{ original_span?: { text?: string } }>;
};

/** Prefer matched span text, then rewrite span, then summary. */
export function resolveClaimAnchorText(finding: ClaimAnchorSource): string {
  const fromSpan = finding.evidence_spans?.[0]?.text?.trim();
  if (fromSpan) return fromSpan;
  const fromRewrite = finding.rewrite_suggestions?.[0]?.original_span?.text?.trim();
  if (fromRewrite) return fromRewrite;
  return finding.summary?.trim() ?? '';
}

/**
 * Group key for evidence-upload cards: same quantitative claim fragment
 * (e.g. "Up to 70%" / "70% faster") shares one card even across modules.
 */
export function claimAnchorGroupKey(finding: ClaimAnchorSource): string {
  const raw = resolveClaimAnchorText(finding);
  const normalized = raw
    .toLowerCase()
    .replace(/[*†‡]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Only split oil/energy away from generic/%-faster cards so "Up to 70%" and
  // "70% faster" still share one upload; "70% less oil" stays separate.
  const dimensionSuffix = oilOrEnergySuffix(normalized);

  const pct = normalized.match(/(?:up to\s+)?(\d+(?:\.\d+)?)\s*%/);
  if (pct) {
    return `pct:${pct[1]}${dimensionSuffix}`;
  }

  const nx = normalized.match(/(\d+(?:\.\d+)?)\s*x\b/);
  if (nx) {
    return `nx:${nx[1]}${dimensionSuffix}`;
  }

  return normalized.slice(0, 120) || finding.finding_id;
}

function oilOrEnergySuffix(normalized: string): string {
  if (/oil|油脂|用油|少油/.test(normalized)) return ':oil';
  if (/energy|节能|节电|功耗/.test(normalized)) return ':energy';
  return '';
}

export type ClaimAnchorEvidenceGroup<T extends ClaimAnchorSource = ClaimAnchorSource> = {
  groupKey: string;
  claimAnchor: string;
  findings: T[];
};

/** One evidence-upload card per claim_anchor group (fan-out attach targets all findings). */
export function groupFindingsByClaimAnchor<T extends ClaimAnchorSource>(
  findings: T[],
): ClaimAnchorEvidenceGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const finding of findings) {
    const key = claimAnchorGroupKey(finding);
    const list = groups.get(key) ?? [];
    list.push(finding);
    groups.set(key, list);
  }

  return Array.from(groups.entries()).map(([groupKey, group]) => {
    const anchors = group.map(resolveClaimAnchorText).filter(Boolean);
    const claimAnchor =
      anchors.sort((a, b) => b.length - a.length)[0] ?? group[0]?.summary ?? groupKey;
    return { groupKey, claimAnchor, findings: group };
  });
}
