/**
 * Gray-copy Open Risk capability scoring helpers.
 *
 * coincidence_only is split:
 * - rule_covered_same_risk → Rule already covers an acceptable risk_type (LLM dedupe OK → PASS)
 * - masked_by_unrelated → only unrelated incidental rules lifted the decision (LLM miss → FAIL)
 */

export type CoincidenceKind = 'rule_covered_same_risk' | 'masked_by_unrelated';

/** Explicit rule_id → taxonomy risk_type(s). Empty = not a semantic peer of gray-copy risks. */
export const RULE_REF_TO_RISK_TYPES: Record<string, string[]> = {
  'demo-sg-sponsored-disclosure': ['sponsored-disclosure'],
  'demo-id-sponsored-disclosure': ['sponsored-disclosure'],
  'demo-ph-sponsored-disclosure': ['sponsored-disclosure'],
  'demo-cn-internet-ad-identifiable-tag': ['sponsored-disclosure'],
  'demo-jp-stealth-marketing-disclosure': ['sponsored-disclosure'],
  'demo-kr-kol-disclosure-format': ['sponsored-disclosure'],
  'demo-apac-sa-urgency-scarcity-claim': ['scarcity-urgency-claim'],
  'demo-apac-sa-health-implication': ['health-implication'],
  'demo-apac-sa-health-claim-blocker': ['medical-claim', 'health-implication'],
  // Registration prerequisites are orthogonal to copy-risk taxonomy:
  'demo-sg-cpsr-registration-prerequisite': [],
  'demo-my-eeca-coe-prerequisite': [],
  'demo-au-children-code-review': ['aana-children-code-risk'],
  'demo-cn-sensitive-content-manual-review': ['sensitive-content-flag'],
};

const TAXONOMY_HINTS = [
  'sponsored-disclosure',
  'scarcity-urgency-claim',
  'health-implication',
  'medical-claim',
  'unsupported-comparative-claim',
  'analogical-claim',
  'absolute-claim-soft',
  'environmental-claim',
  'certification-evidence',
  'unsubstantiated-quantitative-claim',
] as const;

export function normalizeRiskType(refId: string): string {
  return refId.trim().toLowerCase();
}

/** Map a Rule/Playbook ref_id to taxonomy risk types when known. */
export function mapRuleRefToRiskTypes(refId: string): string[] {
  const key = normalizeRiskType(refId);
  if (Object.prototype.hasOwnProperty.call(RULE_REF_TO_RISK_TYPES, key)) {
    return RULE_REF_TO_RISK_TYPES[key]!.map(normalizeRiskType);
  }

  const inferred: string[] = [];
  for (const hint of TAXONOMY_HINTS) {
    if (key.includes(hint) || key.includes(hint.replace(/-/g, '_'))) {
      inferred.push(hint);
    }
  }
  if (key.includes('urgency') && key.includes('scarcity')) {
    inferred.push('scarcity-urgency-claim');
  }
  if (key.includes('sponsored') || key.includes('disclosure') || key.includes('stealth')) {
    inferred.push('sponsored-disclosure');
  }
  return [...new Set(inferred.map(normalizeRiskType))];
}

export type ScoreHitSource = {
  module: 'RULE' | 'PLAYBOOK' | 'LLM' | 'VISION';
  ref_id: string;
  incidental: boolean;
};

export type GrayCopyCapabilityScore = {
  llm_risk_types: string[];
  llm_matched: boolean;
  same_risk_rule_refs: string[];
  rule_covered_same_risk: boolean;
  only_incidental_rules: boolean;
  coincidence_kind: CoincidenceKind | null;
  /** Legacy: true only for masked_by_unrelated (FAIL coincidence). */
  coincidence_only: boolean;
  open_risk_capability_pass: boolean;
};

export function scoreGrayCopyCapability(input: {
  open_risk_must_fire: boolean;
  acceptable_risk_types: string[];
  hit_sources: ScoreHitSource[];
  final_decision: string;
}): GrayCopyCapabilityScore {
  const acceptable = new Set(
    input.acceptable_risk_types.map((t) => normalizeRiskType(t)),
  );

  const llm_risk_types = input.hit_sources
    .filter((h) => h.module === 'LLM')
    .map((h) => normalizeRiskType(h.ref_id));

  const llm_matched = llm_risk_types.some((t) => acceptable.has(t));

  const same_risk_rule_refs = input.hit_sources
    .filter((h) => h.module === 'RULE' || h.module === 'PLAYBOOK')
    .filter((h) =>
      mapRuleRefToRiskTypes(h.ref_id).some((risk) => acceptable.has(risk)),
    )
    .map((h) => h.ref_id);

  const rule_covered_same_risk = same_risk_rule_refs.length > 0;

  const only_incidental_rules =
    input.hit_sources.length > 0 &&
    input.hit_sources.every((h) => h.module === 'RULE' && h.incidental) &&
    llm_risk_types.length === 0;

  let coincidence_kind: CoincidenceKind | null = null;
  if (input.open_risk_must_fire && !llm_matched && input.final_decision !== 'PASS') {
    if (rule_covered_same_risk) {
      coincidence_kind = 'rule_covered_same_risk';
    } else if (only_incidental_rules) {
      coincidence_kind = 'masked_by_unrelated';
    }
  }

  const coincidence_only = coincidence_kind === 'masked_by_unrelated';

  const open_risk_capability_pass = input.open_risk_must_fire
    ? llm_matched || rule_covered_same_risk
    : true;

  return {
    llm_risk_types,
    llm_matched,
    same_risk_rule_refs: [...new Set(same_risk_rule_refs)],
    rule_covered_same_risk,
    only_incidental_rules,
    coincidence_kind,
    coincidence_only,
    open_risk_capability_pass,
  };
}
