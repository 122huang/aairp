export type CaseManifestDto = {
  case_id: string;
  case_version: number;
  path: string;
  review_id: string;
  country_id: string;
  category_id: string;
  platform_id: string;
  language?: string;
  ai_decision: string;
  final_decision: string;
  lifecycle_status: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
  thread_id?: string;
  text_preview?: string;
};

export type CaseSearchParams = {
  case_id?: string;
  thread_id?: string;
  country_id?: string;
  final_decision?: string;
  created_from?: string;
  created_to?: string;
  limit?: number;
  offset?: number;
};

export type CaseListResponse = {
  count: number;
  cases: CaseManifestDto[];
};

export type CaseMatchedFindingDto = {
  finding_id: string;
  ref_id: string;
  ref_version_id: string;
  severity: string;
  decision: string;
  summary: string;
  confidence: number;
  remediation_type?: string;
  evaluation_detail?: {
    riskType?: string;
    matchedSpans?: Array<{ field: string; start: number; end: number; text: string }>;
    evidenceSpans?: Array<{ field: string; start: number; end: number; text: string }>;
  };
};

export type CaseRecordDto = {
  case_id: string;
  case_version: number;
  review_id: string;
  advertisement_id: string;
  thread_id?: string;
  parent_case_id?: string;
  reviewer_id?: string;
  lifecycle_status: string;
  dimensions: {
    tenant_id: string;
    country_id: string;
    platform_id: string;
    category_id: string;
    legal_reviewed_market: boolean;
  };
  advertisement: {
    advertisement_id: string;
    content_hash: string;
    content_version: number;
    ad_type: string;
    content: {
      text: string;
      ocr_text?: string;
      disclaimer_text?: string;
      language?: string;
      image_urls: string[];
      landing_url?: string;
    };
    tags: string[];
  };
  matched_rules: CaseMatchedFindingDto[];
  matched_playbooks: CaseMatchedFindingDto[];
  llm_analysis: {
    prompt_pack_version: string;
    skipped: boolean;
    skip_reason?: string;
    findings: CaseMatchedFindingDto[];
    evaluated_at: string;
  };
  vision_analysis?: {
    prompt_pack_version: string;
    skipped: boolean;
    skip_reason?: string;
    findings: CaseMatchedFindingDto[];
    evaluated_at: string;
  };
  decision: {
    ai_decision: string;
    confidence: number;
    rationale: string;
    finding_counts: { rule: number; playbook: number; llm: number; case?: number };
    decided_at: string;
    final_decision: 'PASS' | 'WARN' | 'REJECT' | 'REVIEW';
  };
  created_at: string;
  updated_at: string;
};

export type CasesApiError = {
  message: string;
  status: number;
  details?: unknown;
};

function toQuery(params: CaseSearchParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function toApiError(response: Response, body: unknown): CasesApiError {
  const message =
    body && typeof body === 'object' && 'detail' in body && typeof (body as { detail: unknown }).detail === 'string'
      ? (body as { detail: string }).detail
      : `请求失败 (${response.status})`;
  return { message, status: response.status, details: body };
}

export async function searchCases(params: CaseSearchParams = {}): Promise<CaseListResponse> {
  const response = await fetch(`/demo/cases${toQuery(params)}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await parseJsonResponse(response);
  if (!response.ok) {
    throw toApiError(response, body);
  }
  return body as CaseListResponse;
}

export async function fetchCase(caseId: string): Promise<CaseRecordDto> {
  const response = await fetch(`/demo/cases/${encodeURIComponent(caseId)}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await parseJsonResponse(response);
  if (!response.ok) {
    throw toApiError(response, body);
  }
  return body as CaseRecordDto;
}
