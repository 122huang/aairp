import type { PaginatedResult, PaginationParams } from './common.js';

export type FeedbackStatus = 'open' | 'triaged' | 'closed';

export const FEEDBACK_STATUSES: FeedbackStatus[] = ['open', 'triaged', 'closed'];

export type FeedbackRecord = {
  feedbackId: string;
  reviewId?: string;
  caseId?: string;
  pilotId?: string;
  status: FeedbackStatus;
  decision?: string;
  ratings: Record<string, number>;
  comment?: string;
  reviewerId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateFeedbackInput = {
  reviewId?: string;
  caseId?: string;
  pilotId?: string;
  decision?: string;
  ratings?: Record<string, number>;
  comment?: string;
  reviewerId?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateFeedbackInput = {
  feedbackId: string;
  status?: FeedbackStatus;
  decision?: string;
  comment?: string;
  ratings?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

export type FeedbackSearchFilters = PaginationParams & {
  reviewId?: string;
  caseId?: string;
  pilotId?: string;
  status?: FeedbackStatus;
};

export type FeedbackUpsertResult = {
  record: FeedbackRecord;
  created: boolean;
};

export type IFeedbackRepository = {
  create(input: CreateFeedbackInput): Promise<FeedbackRecord>;
  update(input: UpdateFeedbackInput): Promise<FeedbackRecord>;
  findById(feedbackId: string): Promise<FeedbackRecord | null>;
  findByCaseId(caseId: string): Promise<FeedbackRecord | null>;
  search(filters: FeedbackSearchFilters): Promise<PaginatedResult<FeedbackRecord>>;
  upsertByCaseId(input: CreateFeedbackInput): Promise<FeedbackUpsertResult>;
};
