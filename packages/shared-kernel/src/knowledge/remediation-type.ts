/** How a finding can be remediated — Phase 1 taxonomy (no AI judgment). */
export type RemediationType =
  | 'REWRITE_ONLY'
  | 'EVIDENCE_SUPPLEMENT'
  | 'EXTERNAL_STATUS_VERIFICATION'
  | 'OUT_OF_SCOPE_INTERNAL_DATA'
  | 'MANUAL_CONTEXT_JUDGMENT'
  /** Business-handoff disclosure reminder; not evidence-attachable. */
  | 'NOT_APPLICABLE_DISCLOSURE';

export const REMEDIATION_TYPES: readonly RemediationType[] = [
  'REWRITE_ONLY',
  'EVIDENCE_SUPPLEMENT',
  'EXTERNAL_STATUS_VERIFICATION',
  'OUT_OF_SCOPE_INTERNAL_DATA',
  'MANUAL_CONTEXT_JUDGMENT',
  'NOT_APPLICABLE_DISCLOSURE',
] as const;

export function isRemediationType(value: string): value is RemediationType {
  return (REMEDIATION_TYPES as readonly string[]).includes(value);
}

/** Findings eligible for evidence attach + AI judgment (Phase 2). */
export function supportsEvidenceAttachment(
  type: RemediationType | undefined,
  decision?: string,
): boolean {
  if (type === 'EVIDENCE_SUPPLEMENT') return true;
  if (type === 'EXTERNAL_STATUS_VERIFICATION') {
    // Category-level INFO reminders skip evidence flow; active assertion findings need it.
    return decision !== undefined && decision !== 'INFO';
  }
  return false;
}

/** Findings that Template A (business handoff) may surface. */
export function isBusinessHandoffRemediationType(
  type: RemediationType | undefined,
): boolean {
  return type === 'EXTERNAL_STATUS_VERIFICATION' || type === 'NOT_APPLICABLE_DISCLOSURE';
}

/**
 * Open Risk / playbook risk_type (or pattern id) values that should open the
 * evidence-supplement path even when the finding did not come from a tagged RULE.
 * Start small: comparative / performance / capacity family only.
 */
export const EVIDENCE_SUPPLEMENT_RISK_TYPES: readonly string[] = [
  'unsupported-comparative-claim',
  'capacity-claim',
  'unsubstantiated-quantitative-claim',
  'sa-comparative-claim',
  'sa-comparative-superiority',
  'sa-performance-claim',
  'sa-capacity-claim',
  'sa-oil-reduction-quantified',
] as const;

const evidenceSupplementRiskTypeSet = new Set<string>(EVIDENCE_SUPPLEMENT_RISK_TYPES);

/** Map a risk_type / playbook pattern id to remediation when no RULE tag exists. */
export function remediationTypeFromRiskType(
  riskType: string | undefined,
): RemediationType | undefined {
  if (!riskType) return undefined;
  return evidenceSupplementRiskTypeSet.has(riskType) ? 'EVIDENCE_SUPPLEMENT' : undefined;
}

/**
 * Resolve remediation for any finding module.
 * RULE tags win; otherwise fall back to risk_type / refId whitelist.
 */
export function resolveFindingRemediationType(input: {
  remediationType?: RemediationType;
  riskType?: string;
  refId?: string;
}): RemediationType | undefined {
  if (input.remediationType) return input.remediationType;
  return remediationTypeFromRiskType(input.riskType ?? input.refId);
}
