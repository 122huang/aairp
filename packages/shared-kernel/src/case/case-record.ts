import type { FinalDecision } from '../decision/review-decision.js';
import type { PlaybookFinding } from '../findings/playbook-finding.js';
import type { RuleFinding } from '../findings/rule-finding.js';
import type { ReviewContext } from '../context/review-context.js';

export const CASE_SCHEMA_VERSION = '1.0.0';

export type CaseLifecycleStatus =
  | 'GENERATED'
  | 'PENDING_HUMAN'
  | 'CONFIRMED'
  | 'DISPUTED'
  | 'ARCHIVED'
  | 'SUPERSEDED';

export type CaseDimensions = {
  tenant_id: string;
  country_id: string;
  platform_id: string;
  category_id: string;
};

export type CaseAdvertisementContent = {
  text: string;
  ocr_text?: string;
  language?: string;
  image_urls: string[];
  landing_url?: string;
};

export type CaseAdvertisement = {
  advertisement_id: string;
  content_hash: string;
  content_version: number;
  ad_type: string;
  content: CaseAdvertisementContent;
  tags: string[];
};

export type CaseContextBuilderOutput = {
  review_id: string;
  content_hash: string;
  content_version: number;
  normalized_content: ReviewContext['normalizedContent'];
  resolved_knowledge_versions: ReviewContext['resolvedKnowledgeVersions'];
  advertisement_context: ReviewContext['advertisementContext'];
  tags: string[];
  built_at: string;
};

export type CaseMatchedFinding = {
  finding_id: string;
  ref_id: string;
  ref_version_id: string;
  severity: string;
  decision: string;
  summary: string;
  confidence: number;
  evaluation_detail?: RuleFinding['evaluationDetail'] | PlaybookFinding['evaluationDetail'];
};

export type CaseLlmAnalysis = {
  prompt_pack_version: string;
  skipped: boolean;
  skip_reason?: string;
  findings: CaseMatchedFinding[];
  evaluated_at: string;
};

export type CaseDecision = {
  ai_decision: FinalDecision;
  confidence: number;
  rationale: string;
  finding_counts: { rule: number; playbook: number; llm: number; case?: number };
  decided_at: string;
  final_decision: FinalDecision;
};

export type CaseEvidence = {
  evidence_id: string;
  source_module: 'RULE' | 'PLAYBOOK' | 'LLM';
  source_ref_id: string;
  evidence_type: 'TEXT_SPAN' | 'CITATION' | 'SUMMARY';
  field?: string;
  start?: number;
  end?: number;
  text?: string;
  regulation_ref?: string;
};

export type CaseRecommendationAction = {
  priority: number;
  action: string;
  target: string;
  detail: string;
};

export type CaseRecommendation = {
  summary: string;
  actions: CaseRecommendationAction[];
  derived_from: string[];
};

export type CaseHumanFeedback = {
  decision: FinalDecision;
  reviewer_id?: string;
  reviewer_role?: string;
  comment?: string;
  submitted_at: string;
  pilot_id?: string;
  agreement_with_ai?: 'AGREE' | 'DISAGREE';
};

export type CaseRegulationRef = {
  law_name: string;
  article?: string;
  jurisdiction: string;
  source_module: 'RULE' | 'PLAYBOOK';
  source_ref_id: string;
};

export type CaseMetadata = {
  source: string;
  pipeline_version: string;
  open_risk_skipped: boolean;
  storage_phase: 'json' | 'postgres';
  review_id: string;
  embedding_id: null;
  similar_case_ids: string[];
};

export type CaseRecord = {
  schema_version: string;
  case_version: number;
  case_id: string;
  review_id: string;
  advertisement_id: string;
  lifecycle_status: CaseLifecycleStatus;
  dimensions: CaseDimensions;
  advertisement: CaseAdvertisement;
  context_builder_output: CaseContextBuilderOutput;
  matched_rules: CaseMatchedFinding[];
  matched_playbooks: CaseMatchedFinding[];
  llm_analysis: CaseLlmAnalysis;
  decision: CaseDecision;
  evidence: CaseEvidence[];
  recommendation: CaseRecommendation;
  human_feedback: CaseHumanFeedback | null;
  reference_regulations: CaseRegulationRef[];
  metadata: CaseMetadata;
  created_at: string;
  updated_at: string;
};

export type CaseManifestEntry = {
  case_id: string;
  case_version: number;
  path: string;
  review_id: string;
  country_id: string;
  category_id: string;
  platform_id: string;
  language?: string;
  ai_decision: FinalDecision;
  final_decision: FinalDecision;
  lifecycle_status: CaseLifecycleStatus;
  content_hash: string;
  created_at: string;
  updated_at: string;
};

export type CaseSearchFilters = {
  country_id?: string;
  category_id?: string;
  platform_id?: string;
  language?: string;
  ai_decision?: FinalDecision;
  final_decision?: FinalDecision;
  lifecycle_status?: CaseLifecycleStatus;
  review_id?: string;
  content_hash?: string;
  limit?: number;
  offset?: number;
};

export type CaseSaveResult = {
  case_id: string;
  path: string;
  created: boolean;
};
