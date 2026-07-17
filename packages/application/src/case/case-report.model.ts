import type {
  CaseMatchedFinding,
  CaseRecord,
  EvidenceAiJudgment,
  EvidenceRecord,
  FindingEvidenceLink,
  FinalDecision,
  RemediationType,
} from '@aairp/shared-kernel';
import type { CaseEffectiveStatusView } from './case-effective-status.js';

export const CASE_REPORT_TEMPLATES = ['business_handoff', 'legal_audit'] as const;
export type CaseReportTemplate = (typeof CASE_REPORT_TEMPLATES)[number];

export function isCaseReportTemplate(value: string): value is CaseReportTemplate {
  return (CASE_REPORT_TEMPLATES as readonly string[]).includes(value);
}

export type CaseReportEvidenceLink = FindingEvidenceLink & {
  evidence: Pick<
    EvidenceRecord,
    | 'evidence_id'
    | 'title'
    | 'evidence_source_type'
    | 'issuing_institution'
    | 'issued_date'
    | 'valid_until'
    | 'scope'
    | 'claim_risk_types'
    | 'file'
    | 'created_at'
  >;
};

export type CaseReportFinding = CaseMatchedFinding & {
  module: 'RULE' | 'PLAYBOOK' | 'LLM' | 'VISION';
};

export type BusinessHandoffEligibility =
  | { eligible: true }
  | {
      eligible: false;
      code:
        | 'REJECT_UNRESOLVED'
        | 'REVIEW_MANUAL_CONTEXT'
        | 'REVIEW_EVIDENCE_INCOMPLETE'
        | 'REVIEW_NO_FINDINGS';
      reasons: string[];
    };

/** Pre-publish handoff items (EXTERNAL_STATUS_VERIFICATION / disclosure). */
export type PublishTodoItem = {
  finding_id: string;
  ref_id: string;
  summary: string;
  remediation_type: RemediationType;
  decision: string;
};

export type CaseReportModel = {
  template: CaseReportTemplate;
  generated_at: string;
  case: CaseRecord;
  thread_cases: CaseRecord[];
  findings: CaseReportFinding[];
  handoff_findings: CaseReportFinding[];
  /** Same handoff set, shaped for the legal-audit “发布前待办” layer. */
  publish_todos: PublishTodoItem[];
  evidence_links: CaseReportEvidenceLink[];
  business_handoff: BusinessHandoffEligibility;
  /** User-facing conclusion; does not mutate fusion final_decision. */
  effective: CaseEffectiveStatusView;
};

export type CaseReportRenderResult = {
  template: CaseReportTemplate;
  case_id: string;
  content_type: 'text/html; charset=utf-8';
  filename: string;
  html: string;
  /** False only for business_handoff when the case gate fails (HTML still explains why). */
  exportable: boolean;
};

export type HandoffFindingView = {
  finding_id: string;
  ref_id: string;
  decision: string;
  severity: string;
  summary: string;
  remediation_type?: RemediationType;
};

export type EvidenceReportView = {
  link_id: string;
  finding_id: string;
  status: FindingEvidenceLink['status'];
  evidence_title: string;
  evidence_source_type: string;
  issuing_institution?: string;
  filename: string;
  /** Metadata-only when relevance is none or prescreen excluded. */
  disclosure: 'metadata_only' | 'judgment_excerpt';
  ai_judgment?: Pick<
    EvidenceAiJudgment,
    | 'relevance'
    | 'sufficiency'
    | 'relevance_reasoning'
    | 'sufficiency_reasoning'
    | 'extracted_key_facts'
    | 'prescreen_excluded'
    | 'source_rule_applied'
  >;
  override_reason?: string;
  confirmed_at?: string;
};

export type ThreadCaseView = {
  case_id: string;
  review_id: string;
  parent_case_id?: string;
  final_decision: FinalDecision;
  created_at: string;
  rationale: string;
  finding_counts: CaseRecord['decision']['finding_counts'];
  is_current: boolean;
};
