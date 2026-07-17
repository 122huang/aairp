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
