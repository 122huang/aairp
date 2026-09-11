/** Result-page premise: uploaded materials are treated as authentic. */
export const CLAIM_OPINION_PRE_REVIEW_DISCLAIMER =
  '以下为工具初审意见。审核以本次提交的材料为真实前提。';

/** User-facing claim opinion kind (API). UI copy is separate written Chinese. */
export type ClaimOpinionKind =
  | 'prohibited'
  | 'needs_substantiation'
  | 'substantiation_weak'
  | 'substantiation_supports'
  | 'copy_only'
  | 'unused_evidence'
  /** Pool files present but correspondence was never run (no attachable finding). */
  | 'evidence_not_evaluated';

export type ClaimOpinionEvidenceView = {
  evidence_id: string;
  title: string;
  filename: string;
  relevance?: string;
  sufficiency?: string;
  excerpt?: string;
  relevance_reasoning?: string;
  sufficiency_reasoning?: string;
  text_unreadable?: boolean;
};

export type ClaimOpinion = {
  kind: ClaimOpinionKind;
  /** Short written-Chinese label, e.g. 不得使用 */
  label: string;
  /** One-paragraph written-Chinese conclusion */
  summary: string;
  claim_anchor: string;
  finding_ids: string[];
  ref_ids: string[];
  quote?: string;
  evidence?: ClaimOpinionEvidenceView[];
};
