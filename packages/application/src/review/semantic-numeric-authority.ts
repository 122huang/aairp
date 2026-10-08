import { randomUUID } from 'node:crypto';
import type { RuleFinding } from '@aairp/shared-kernel';

/** Frozen P0.5C / P0.5E.2 Canonical Ontology predicates — no case-specific families. */
export const AUTHORITATIVE_NUMERIC_PREDICATES = [
  'nutrient_retention',
  'comparative_performance',
  'measurable_specification',
] as const;

/** Frozen claim_form enums produced by the P0.5E.2 normalizer. */
export const AUTHORITATIVE_NUMERIC_CLAIM_FORMS = [
  'quantified_product_benefit',
  'quantified_comparative',
  'bare_specification',
] as const;

export const AUTHORITATIVE_NUMERIC_RELATIONS = [
  'exact',
  'upper_bound',
  'lower_bound',
  'range',
  'approximate',
  'comparative_delta',
  'multiplicative',
] as const;

export const NUMERIC_EQUIVALENT_RULE_IDS = [
  'demo-apac-sa-performance-claim',
  'demo-apac-sa-capacity-claim',
  'demo-apac-sa-comparative-claim',
] as const;

export const NUMERIC_EQUIVALENT_PLAYBOOK_IDS = [
  'unsupported-comparative-claim',
  'capacity-claim',
  'unsubstantiated-quantitative-claim',
  'sa-comparative-claim',
  'sa-comparative-superiority',
  'sa-performance-claim',
  'sa-capacity-claim',
  'sa-oil-reduction-quantified',
] as const;

const PERFORMANCE_SUMMARY =
  'Unsubstantiated quantitative claim: numbers or percentages without comparison baseline, reference product, test standard, or data source (WARN)';
const CAPACITY_SUMMARY =
  'Capacity or volume claims (e.g. up to X kg/bowls) require substantiation and clear test conditions';

export type NumericCanonicalProposition = {
  predicate?: string;
  claim_form?: string;
  relation?: string;
  value?: number | null;
  low?: number | null;
  high?: number | null;
  unit?: string | null;
  metric?: string | null;
  primary_grounding_span?: string | null;
  conflicts?: string[];
};

export type NumericNormalizeResult = {
  status: string;
  reason?: string;
  proposition?: NumericCanonicalProposition | null;
  conflicts?: string[];
};

export type LegalNumericMapping = {
  ruleId: string;
  ruleVersionId: string;
  severity: RuleFinding['severity'];
  decision: 'WARN';
  summary: string;
  remediationType: 'EVIDENCE_SUPPLEMENT';
  evidenceHandoff: true;
  citation: { lawName: string; article: string };
};

export type AuthorityGateResult =
  | { pass: true; mapping: LegalNumericMapping; proposition: NumericCanonicalProposition }
  | { pass: false; reason: string };

function mappingFor(proposition: NumericCanonicalProposition): LegalNumericMapping | null {
  if (proposition.metric === 'capacity') {
    return {
      ruleId: 'demo-apac-sa-capacity-claim',
      ruleVersionId: 'demo-apac-sa-capacity-claim-v1',
      severity: 'MEDIUM',
      decision: 'WARN',
      summary: CAPACITY_SUMMARY,
      remediationType: 'EVIDENCE_SUPPLEMENT',
      evidenceHandoff: true,
      citation: {
        lawName: 'APAC Advertising Standards (Demo)',
        article: 'Capacity claims — substantiation required',
      },
    };
  }
  if (
    proposition.predicate === 'nutrient_retention' ||
    proposition.predicate === 'comparative_performance' ||
    proposition.predicate === 'measurable_specification'
  ) {
    return {
      ruleId: 'demo-apac-sa-performance-claim',
      ruleVersionId: 'demo-apac-sa-performance-claim-v5',
      severity: 'HIGH',
      decision: 'WARN',
      summary: PERFORMANCE_SUMMARY,
      remediationType: 'EVIDENCE_SUPPLEMENT',
      evidenceHandoff: true,
      citation: {
        lawName: 'APAC Advertising Standards (Demo)',
        article: 'Performance claims — substantiation required',
      },
    };
  }
  return null;
}

function hasNumericAnchor(anchors: Array<{ kind?: string }>): boolean {
  return anchors.some((anchor) =>
    ['value', 'written_number', 'range', 'explicit_percentage'].includes(anchor.kind ?? ''),
  );
}

export function existingNumericEquivalent(
  ruleFindings: Array<{ refId?: string }>,
  playbookFindings: Array<{ refId?: string }>,
): boolean {
  const rules = new Set(NUMERIC_EQUIVALENT_RULE_IDS as readonly string[]);
  const books = new Set(NUMERIC_EQUIVALENT_PLAYBOOK_IDS as readonly string[]);
  if (ruleFindings.some((finding) => finding.refId && rules.has(finding.refId))) {
    return true;
  }
  return playbookFindings.some((finding) => finding.refId && books.has(finding.refId));
}

export function applyNumericAuthorityGate(input: {
  copy: string;
  anchors: Array<{ kind?: string }>;
  proposal: { material?: boolean; primary_grounding_span?: string } | null;
  normalized: NumericNormalizeResult;
}): AuthorityGateResult {
  const span = input.proposal?.primary_grounding_span;
  if (!input.proposal || typeof span !== 'string' || !input.copy.includes(span)) {
    return { pass: false, reason: 'GROUNDING_INVALID' };
  }
  if (input.proposal.material === false) {
    return { pass: false, reason: 'NON_MATERIAL_NUMBER' };
  }
  if (!hasNumericAnchor(input.anchors)) {
    return { pass: false, reason: 'DETERMINISTIC_NUMERIC_ANCHOR_MISSING' };
  }
  if (input.normalized.status !== 'canonical' || !input.normalized.proposition) {
    return { pass: false, reason: input.normalized.reason ?? 'NORMALIZER_ABSTAIN' };
  }
  const proposition = input.normalized.proposition;
  if ((proposition.conflicts ?? []).includes('CONSISTENCY_CONFLICT')) {
    return { pass: false, reason: 'CONSISTENCY_CONFLICT' };
  }
  if (!AUTHORITATIVE_NUMERIC_PREDICATES.includes(proposition.predicate as never)) {
    return { pass: false, reason: 'FAMILY_NOT_IN_ALLOWLIST' };
  }
  if (!AUTHORITATIVE_NUMERIC_CLAIM_FORMS.includes(proposition.claim_form as never)) {
    return { pass: false, reason: 'FAMILY_NOT_IN_ALLOWLIST' };
  }
  if (!AUTHORITATIVE_NUMERIC_RELATIONS.includes(proposition.relation as never)) {
    return { pass: false, reason: 'QUANTITY_RELATION_NOT_CANONICAL' };
  }
  if (!proposition.unit) {
    return { pass: false, reason: 'UNIT_NOT_CANONICAL' };
  }
  if (!proposition.metric) {
    return { pass: false, reason: 'METRIC_NOT_CANONICAL' };
  }
  if (!proposition.predicate) {
    return { pass: false, reason: 'PREDICATE_NOT_CANONICAL' };
  }
  const mapping = mappingFor(proposition);
  if (!mapping) {
    return { pass: false, reason: 'LEGAL_MAPPING_UNAVAILABLE' };
  }
  return { pass: true, mapping, proposition };
}

export function buildSemanticNumericSupplementalFinding(input: {
  mapping: LegalNumericMapping;
  copy: string;
  span: string;
}): RuleFinding {
  const start = input.copy.indexOf(input.span);
  const end = start >= 0 ? start + input.span.length : 0;
  return {
    module: 'RULE',
    findingId: `rf_semnum_${randomUUID()}`,
    severity: input.mapping.severity,
    decision: input.mapping.decision,
    refType: 'RULE',
    refId: input.mapping.ruleId,
    refVersionId: input.mapping.ruleVersionId,
    summary: input.mapping.summary,
    confidence: 1,
    remediationType: input.mapping.remediationType,
    evaluationDetail: {
      matchedSpans:
        start >= 0
          ? [{ field: 'text', start, end, text: input.span }]
          : undefined,
      citation: input.mapping.citation,
    },
  };
}
