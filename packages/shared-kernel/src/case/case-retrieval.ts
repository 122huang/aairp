import type { ReviewContext } from '../context/review-context.js';
import type { FinalDecision } from '../decision/review-decision.js';
import type { CaseLifecycleStatus } from './case-record.js';

export type CasePrecedent = {
  case_id: string;
  case_version: number;
  lifecycle_status: CaseLifecycleStatus;
  final_decision: FinalDecision;
  similarity_score: number;
  match_reason: string;
  summary: string;
};

export type CaseRetrievalResult = {
  review_id: string;
  precedents: CasePrecedent[];
  exact_content_hash_match: boolean;
  coverage_score: number;
  retrieval_strategy: string;
  retrieved_at: string;
};

export type ICaseRetrievalService = {
  retrieve(context: ReviewContext): Promise<CaseRetrievalResult>;
};
