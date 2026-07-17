import type { EvidenceSourceType, FindingEvidenceStatus } from '@aairp/shared-kernel';

export type EvidenceAiJudgmentDto = {
  relevance: 'strong' | 'partial' | 'none';
  relevance_reasoning: string;
  sufficiency: 'sufficient' | 'insufficient';
  sufficiency_reasoning: string;
  extracted_key_facts: string;
  prescreen_excluded?: boolean;
  source_rule_applied?: boolean;
  text_unreadable?: boolean;
  judged_at: string;
};

export type EvidenceRecordDto = {
  evidence_id: string;
  title: string;
  evidence_source_type: EvidenceSourceType;
  issuing_institution?: string;
  issued_date?: string;
  valid_until?: string;
  scope: {
    countries?: string[];
    categories?: string[];
    skus?: string[];
  };
  claim_risk_types: string[];
  file: {
    filename: string;
    mime_type: string;
    storage_path: string;
  };
  created_at: string;
};

export type FindingEvidenceLinkDto = {
  link_id: string;
  case_id: string;
  review_id: string;
  finding_id: string;
  evidence_id: string;
  status: FindingEvidenceStatus;
  ai_judgment?: EvidenceAiJudgmentDto;
  override_reason?: string;
  confirmed_at?: string;
  created_at: string;
  evidence: EvidenceRecordDto;
};

export type AttachEvidencePayload = {
  review_id: string;
  finding_id: string;
  case_id?: string;
  title: string;
  evidence_source_type: EvidenceSourceType;
  issuing_institution?: string;
  issued_date?: string;
  valid_until?: string;
  scope?: EvidenceRecordDto['scope'];
  claim_risk_types?: string[];
  file: {
    filename: string;
    mime_type: string;
    content_base64: string;
  };
  judgment_context: {
    country_id: string;
    category_id: string;
    product_sku?: string;
    ad_text: string;
    finding_summary: string;
    remediation_type?: string;
    risk_type: string;
    claim_anchor_text: string;
    matched_spans?: Array<{ field: string; start?: number; end?: number; text: string }>;
  };
};

export async function listFindingEvidence(
  reviewId: string,
  findingId: string,
): Promise<FindingEvidenceLinkDto[]> {
  const response = await fetch(
    `/demo/reviews/${encodeURIComponent(reviewId)}/findings/${encodeURIComponent(findingId)}/evidence`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error(`Failed to load evidence (${response.status})`);
  const body = (await response.json()) as { links: FindingEvidenceLinkDto[] };
  return body.links;
}

export async function attachFindingEvidence(
  payload: AttachEvidencePayload,
): Promise<FindingEvidenceLinkDto> {
  const response = await fetch('/demo/finding-evidence', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string'
        ? body.detail
        : `Attach evidence failed (${response.status})`;
    throw new Error(message);
  }
  return response.json() as Promise<FindingEvidenceLinkDto>;
}

export async function confirmFindingEvidence(
  linkId: string,
  action: 'confirm' | 'override_accept' | 'override_reject',
  overrideReason?: string,
): Promise<FindingEvidenceLinkDto> {
  const response = await fetch(`/demo/finding-evidence/${encodeURIComponent(linkId)}/confirm`, {
    method: 'PATCH',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, override_reason: overrideReason }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string'
        ? body.detail
        : `Confirm evidence failed (${response.status})`;
    throw new Error(message);
  }
  return response.json() as Promise<FindingEvidenceLinkDto>;
}

export const EVIDENCE_SOURCE_TYPE_OPTIONS: { value: EvidenceSourceType; label: string }[] = [
  { value: 'THIRD_PARTY_LAB', label: '第三方实验室报告' },
  { value: 'OFFICIAL_CERTIFICATION', label: '官方认证/备案' },
  { value: 'INTERNAL_TEST', label: '内部测试记录' },
  { value: 'THIRD_PARTY_SURVEY', label: '第三方调研/排名' },
];
