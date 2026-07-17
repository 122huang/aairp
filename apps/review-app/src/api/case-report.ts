export type CaseReportTemplate = 'business_handoff' | 'legal_audit';

export function caseReportUrl(caseId: string, template: CaseReportTemplate): string {
  const params = new URLSearchParams({ template });
  return `/demo/cases/${encodeURIComponent(caseId)}/report?${params.toString()}`;
}

/** Open HTML report in a new tab (same-origin; Basic Auth cookie/header reuse applies). */
export function openCaseReport(caseId: string, template: CaseReportTemplate): void {
  window.open(caseReportUrl(caseId, template), '_blank', 'noopener,noreferrer');
}
