/** Convert YYYY-MM-DD local date input to inclusive ISO lower bound. */
export function toCreatedFrom(dateLocal: string): string | undefined {
  if (!dateLocal) return undefined;
  return new Date(`${dateLocal}T00:00:00`).toISOString();
}

/** Convert YYYY-MM-DD local date input to inclusive ISO upper bound. */
export function toCreatedTo(dateLocal: string): string | undefined {
  if (!dateLocal) return undefined;
  return new Date(`${dateLocal}T23:59:59.999`).toISOString();
}

export type HistorySearchForm = {
  caseId: string;
  threadId: string;
  countryId: string;
  decision: string;
  dateFrom: string;
  dateTo: string;
};

/** Build GET /demo/cases query params from the history filter form. */
export function buildHistorySearchParams(form: HistorySearchForm): Record<string, string | number> {
  return {
    ...(form.caseId.trim() ? { case_id: form.caseId.trim() } : {}),
    ...(form.threadId.trim() ? { thread_id: form.threadId.trim() } : {}),
    ...(form.countryId ? { country_id: form.countryId } : {}),
    ...(form.decision ? { final_decision: form.decision } : {}),
    ...(form.dateFrom ? { created_from: toCreatedFrom(form.dateFrom)! } : {}),
    ...(form.dateTo ? { created_to: toCreatedTo(form.dateTo)! } : {}),
    limit: 50,
    offset: 0,
  };
}
