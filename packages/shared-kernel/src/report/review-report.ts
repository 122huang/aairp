import type { CasePrecedent } from '../case/case-retrieval.js';
import type { FinalDecision } from '../decision/review-decision.js';

export type ReviewReportAdvertisementSummary = {
  textPreview: string;
  countryId: string;
  platformId: string;
  categoryId: string;
};

export type ReviewReportFindingSummary = {
  module: string;
  refId: string;
  severity: string;
  decision: string;
  summary: string;
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
  };
  advertisement: ReviewReportAdvertisementSummary;
  findings: ReviewReportFindingSummary[];
  openRiskSkipped: boolean;
  openRiskSkipReason?: string;
  casePrecedents?: CasePrecedent[];
};

export type ReviewReportResult = {
  reviewId: string;
  advertisementId: string;
  reportHtml: string;
  summary: ReviewReportSummary;
  generatedAt: string;
};
