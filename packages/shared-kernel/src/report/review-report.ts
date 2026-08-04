import type { CasePrecedent } from '../case/case-retrieval.js';
import type { BranchVerdicts, FinalDecision } from '../decision/review-decision.js';
import type { RewriteSuggestion } from '../findings/rewrite-suggestion.js';
import type { RemediationType } from '../knowledge/remediation-type.js';

export type ReviewReportAdvertisementSummary = {
  textPreview: string;
  countryId: string;
  platformId: string;
  categoryId: string;
};

export type ReviewReportFindingSummary = {
  findingId: string;
  module: string;
  refId: string;
  severity: string;
  decision: string;
  summary: string;
  remediationType?: RemediationType;
  evidenceSpans?: Array<{
    field: string;
    start?: number;
    end?: number;
    text: string;
  }>;
  rewriteSuggestions?: RewriteSuggestion[];
};

export type ReviewReportSummary = {
  finalDecision: FinalDecision;
  confidence: number;
  rationale: string;
  findingCounts: {
    rule: number;
    playbook: number;
    llm: number;
    case?: number;
    vision?: number;
    consistency?: number;
  };
  /** Multimodal branch breakdown when available (ADR-005 / Sprint 6A-6). */
  branchVerdicts?: BranchVerdicts;
  /** Vision gateway mode used for this review. */
  visionMode?: 'off' | 'stub' | 'live';
  advertisement: ReviewReportAdvertisementSummary;
  findings: ReviewReportFindingSummary[];
  openRiskSkipped: boolean;
  openRiskSkipReason?: string;
  /** True when AI gap-fill was attempted but did not finish (fail-soft). */
  openRiskIncomplete: boolean;
  openRiskIncompleteReason?: string;
  casePrecedents?: CasePrecedent[];
};

export type ReviewReportResult = {
  reviewId: string;
  advertisementId: string;
  reportHtml: string;
  summary: ReviewReportSummary;
  generatedAt: string;
};
