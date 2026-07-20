import type { CaseRecord } from '@aairp/shared-kernel';

export function buildCaseSearchText(record: CaseRecord): string {
  return [
    record.case_id,
    record.review_id,
    record.advertisement.content.text,
    record.decision.rationale,
    ...record.matched_rules.map((finding) => finding.summary),
    ...record.matched_playbooks.map((finding) => finding.summary),
    ...record.llm_analysis.findings.map((finding) => finding.summary),
    ...(record.vision_analysis?.findings ?? []).map((finding) => finding.summary),
  ]
    .filter((value) => value.length > 0)
    .join('\n');
}

/** Short text preview for case list UIs (empty when copy was image-only). */
export function buildCaseTextPreview(record: CaseRecord, maxLength = 120): string {
  const text =
    record.advertisement.content.text?.trim() ||
    record.advertisement.content.ocr_text?.trim() ||
    '';
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function kosCaseStoragePath(caseId: string, caseVersion: number): string {
  return `kos://${caseId}/v${caseVersion}`;
}
