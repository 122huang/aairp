/** Source authority tier for substantiation evidence. */
export type EvidenceSourceType =
  | 'THIRD_PARTY_LAB'
  | 'OFFICIAL_CERTIFICATION'
  | 'INTERNAL_TEST'
  | 'THIRD_PARTY_SURVEY';

export const EVIDENCE_SOURCE_TYPES: readonly EvidenceSourceType[] = [
  'THIRD_PARTY_LAB',
  'OFFICIAL_CERTIFICATION',
  'INTERNAL_TEST',
  'THIRD_PARTY_SURVEY',
] as const;

/** Workflow status for finding ↔ evidence link (Phase 2). */
export type FindingEvidenceStatus =
  | 'NO_EVIDENCE'
  | 'AI_PENDING'
  | 'AI_JUDGED_PENDING_CONFIRMATION'
  | 'HUMAN_CONFIRMED'
  | 'HUMAN_OVERRODE';

export type EvidenceJudgmentRelevance = 'strong' | 'partial' | 'none';

export type EvidenceJudgmentSufficiency = 'sufficient' | 'insufficient';

/** AI judgment output schema (v1). */
export type EvidenceAiJudgment = {
  relevance: EvidenceJudgmentRelevance;
  relevance_reasoning: string;
  sufficiency: EvidenceJudgmentSufficiency;
  sufficiency_reasoning: string;
  extracted_key_facts: string;
  /** true when structural prescreen returned none (LLM skipped). */
  prescreen_excluded?: boolean;
  /** true when deterministic source-type rules capped the result. */
  source_rule_applied?: boolean;
  /** true when evidence text could not be extracted (no OCR in v1). */
  text_unreadable?: boolean;
  /**
   * Which LLM path produced this judgment.
   * stub = fixed demo/evidence-judgment.stub.json (ignores document text).
   * live = real provider call. Always stamp so operators can audit misconfig.
   */
  judgment_mode?: 'live' | 'stub';
  /** Concrete model id when live; "stub" when judgment_mode=stub. */
  llm_model?: string;
  judged_at: string;
  prompt_pack_version?: string;
};

/** Reusable substantiation document. */
export type EvidenceRecord = {
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
  /** risk_type taxonomy tags this evidence can substantiate */
  claim_risk_types: string[];
  file: {
    filename: string;
    mime_type: string;
    /** Relative path under evidence store root */
    storage_path: string;
  };
  created_at: string;
};

/** Links a finding in a review case to uploaded evidence + human confirmation. */
export type FindingEvidenceLink = {
  link_id: string;
  case_id: string;
  review_id: string;
  finding_id: string;
  evidence_id: string;
  status: FindingEvidenceStatus;
  ai_judgment?: EvidenceAiJudgment;
  /** Required when HUMAN_OVERRODE upgrades AI insufficient/none → sufficient. */
  override_reason?: string;
  confirmed_at?: string;
  created_at: string;
  /** @deprecated Phase 1 — migrated to status on read */
  human_confirmed?: boolean;
};

export type CreateEvidenceInput = {
  title: string;
  evidence_source_type: EvidenceSourceType;
  issuing_institution?: string;
  issued_date?: string;
  valid_until?: string;
  scope?: EvidenceRecord['scope'];
  claim_risk_types?: string[];
  file: {
    filename: string;
    mime_type: string;
    content_base64: string;
  };
};

export type AttachEvidenceInput = {
  review_id: string;
  case_id?: string;
  finding_id: string;
  evidence_id: string;
};

export type ConfirmEvidenceLinkInput = {
  link_id: string;
  /** confirm = accept AI judgment; override_accept = human upgrades insufficient→sufficient; override_reject = human more conservative */
  action: 'confirm' | 'override_accept' | 'override_reject';
  override_reason?: string;
};

export type UpdateEvidenceLinkInput = {
  link_id: string;
  status?: FindingEvidenceStatus;
  ai_judgment?: EvidenceAiJudgment;
  override_reason?: string;
  confirmed_at?: string;
};

/** Case + finding context passed into judgment. */
export type EvidenceJudgmentContext = {
  review_id: string;
  country_id: string;
  category_id: string;
  product_sku?: string;
  ad_text: string;
  finding_id: string;
  finding_summary: string;
  remediation_type?: string;
  risk_type: string;
  claim_anchor_text: string;
  matched_spans?: Array<{ field: string; start?: number; end?: number; text: string }>;
};

export function migrateLinkStatus(link: FindingEvidenceLink): FindingEvidenceLink {
  if (link.status) return link;
  if (link.human_confirmed === true) {
    return { ...link, status: 'HUMAN_CONFIRMED' };
  }
  if (link.ai_judgment) {
    return { ...link, status: 'AI_JUDGED_PENDING_CONFIRMATION' };
  }
  return { ...link, status: 'AI_JUDGED_PENDING_CONFIRMATION' };
}
