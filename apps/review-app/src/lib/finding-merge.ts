import type { ReviewFindingDto } from '@/api/review';
import routesDoc from '../../../../docs/knowledge/risk-rewrite-routes.json';
import skillDoc from '../../../../docs/knowledge/skill-modules.json';
import { severityRank } from './review-ui';

export type EvidenceSpan = {
  field: string;
  start?: number;
  end?: number;
  text: string;
};

export type MergedFinding = {
  riskType: string;
  modules: string[];
  severity: string;
  decision: string;
  summary: string;
  refIds: string[];
  rewriteSuggestions: NonNullable<ReviewFindingDto['rewrite_suggestions']>;
  evidenceSpans: EvidenceSpan[];
};

const MODULE_ORDER = ['RULE', 'PLAYBOOK', 'CASE', 'LLM', 'VISION', 'POLICY'];

/** UI-only merge map for MANUAL_REVIEW rules (not in risk-rewrite-routes — no rewrite generation). */
const MANUAL_REVIEW_RULE_TO_RISK: Record<string, string> = {
  'demo-au-children-code-review': 'aana-children-code-risk',
  'demo-cn-sensitive-content-manual-review': 'sensitive-content-flag',
};

const ruleIdToRiskType = new Map<string, string>();
for (const route of routesDoc.routes) {
  for (const ruleId of route.rule_ids ?? []) {
    ruleIdToRiskType.set(ruleId, route.risk_type);
  }
}
for (const [ruleId, riskType] of Object.entries(MANUAL_REVIEW_RULE_TO_RISK)) {
  ruleIdToRiskType.set(ruleId, riskType);
}

const patternIdToRiskType = new Map<string, string>();
const patternLinks = skillDoc.pattern_rule_links as Record<string, string[]>;
for (const [patternId, ruleIds] of Object.entries(patternLinks)) {
  for (const ruleId of ruleIds) {
    const riskType = ruleIdToRiskType.get(ruleId);
    if (riskType) {
      patternIdToRiskType.set(patternId, riskType);
      break;
    }
  }
}

export function resolveFindingRiskType(finding: ReviewFindingDto): string {
  const fromRewrite = finding.rewrite_suggestions?.[0]?.risk_type?.trim();
  if (fromRewrite) return fromRewrite;

  if (finding.module === 'RULE') {
    return ruleIdToRiskType.get(finding.ref_id) ?? finding.ref_id;
  }

  if (finding.module === 'PLAYBOOK') {
    return patternIdToRiskType.get(finding.ref_id) ?? finding.ref_id;
  }

  return ruleIdToRiskType.get(finding.ref_id) ?? finding.ref_id;
}

export function extractEvidenceSpans(finding: ReviewFindingDto): EvidenceSpan[] {
  const spans: EvidenceSpan[] = [];

  if (finding.evidence_spans?.length) {
    spans.push(...finding.evidence_spans);
  }

  for (const rewrite of finding.rewrite_suggestions ?? []) {
    const span = rewrite.original_span;
    if (span?.text?.trim()) {
      spans.push(span);
    }
  }

  return spans;
}

function pickSummary(findings: ReviewFindingDto[]): string {
  const rule = findings.find((f) => f.module === 'RULE');
  if (rule) return rule.summary;
  const playbook = findings.find((f) => f.module === 'PLAYBOOK');
  if (playbook) return playbook.summary;
  return findings[0]?.summary ?? '';
}

function pickDecision(findings: ReviewFindingDto[]): string {
  const priority = ['FAIL', 'REJECT', 'WARN', 'REVIEW', 'CONDITIONAL', 'PASS', 'INFO'];
  for (const decision of priority) {
    if (findings.some((f) => f.decision === decision)) return decision;
  }
  return findings[0]?.decision ?? 'WARN';
}

function orderModules(modules: string[]): string[] {
  return [...new Set(modules)].sort(
    (a, b) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b),
  );
}

export {
  claimAnchorGroupKey,
  groupFindingsByClaimAnchor,
  resolveClaimAnchorText,
  type ClaimAnchorEvidenceGroup,
} from '@aairp/shared-kernel';

export function mergeFindingsByRiskType(findings: ReviewFindingDto[]): MergedFinding[] {
  const groups = new Map<string, ReviewFindingDto[]>();

  for (const finding of findings) {
    const riskType = resolveFindingRiskType(finding);
    const group = groups.get(riskType) ?? [];
    group.push(finding);
    groups.set(riskType, group);
  }

  const merged = Array.from(groups.entries()).map(([riskType, group]) => {
    const severity = group.reduce(
      (best, f) => (severityRank(f.severity) < severityRank(best) ? f.severity : best),
      group[0]!.severity,
    );

    const rewriteSuggestions = group.flatMap((f) => f.rewrite_suggestions ?? []);
    const seenSuggestionIds = new Set<string>();
    const uniqueRewrites = rewriteSuggestions.filter((s) => {
      if (seenSuggestionIds.has(s.suggestion_id)) return false;
      seenSuggestionIds.add(s.suggestion_id);
      return true;
    });

    const evidenceSpans = group.flatMap(extractEvidenceSpans);

    return {
      riskType,
      modules: orderModules(group.map((f) => f.module)),
      severity,
      decision: pickDecision(group),
      summary: pickSummary(group),
      refIds: [...new Set(group.map((f) => f.ref_id))],
      rewriteSuggestions: uniqueRewrites,
      evidenceSpans,
    };
  });

  return merged.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}
