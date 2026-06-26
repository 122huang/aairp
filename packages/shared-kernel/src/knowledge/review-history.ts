import type { PaginatedResult, PaginationParams } from './common.js';

export type ReviewRunRecord = {
  reviewRunId: string;
  reviewId: string;
  advertisementId: string;
  tenantId: string;
  countryId: string;
  platformId: string;
  categoryId: string;
  contentHash?: string;
  adTextPreview?: string;
  aiDecision: string;
  finalDecision: string;
  confidence: number;
  rationale?: string;
  findingCounts: { rule: number; playbook: number; llm: number; case?: number };
  reportHtml?: string;
  metadata: Record<string, unknown>;
  reviewedAt: string;
  createdAt: string;
  findingRefs: ReviewFindingRef[];
};

export type ReviewFindingRef = {
  findingRefId: string;
  module: string;
  refId: string;
  severity?: string;
  decision?: string;
  summary?: string;
};

export type CreateReviewRunInput = {
  reviewId: string;
  advertisementId: string;
  tenantId?: string;
  countryId: string;
  platformId: string;
  categoryId: string;
  contentHash?: string;
  adTextPreview?: string;
  aiDecision: string;
  finalDecision: string;
  confidence: number;
  rationale?: string;
  findingCounts?: { rule: number; playbook: number; llm: number };
  reportHtml?: string;
  metadata?: Record<string, unknown>;
  reviewedAt: string;
  findingRefs?: Array<Omit<ReviewFindingRef, 'findingRefId'>>;
};

export type ReviewSearchFilters = PaginationParams & {
  countryId?: string;
  categoryId?: string;
  platformId?: string;
  finalDecision?: string;
  reviewId?: string;
};

export type IReviewHistoryRepository = {
  create(input: CreateReviewRunInput): Promise<ReviewRunRecord>;
  findByReviewId(reviewId: string): Promise<ReviewRunRecord | null>;
  search(filters: ReviewSearchFilters): Promise<PaginatedResult<ReviewRunRecord>>;
};
