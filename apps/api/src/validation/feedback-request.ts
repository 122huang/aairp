import { AppError, assertFeedbackStatus, validateFeedbackRatings } from '@aairp/shared-kernel';
import type { FeedbackSearchFilters, FeedbackStatus } from '@aairp/shared-kernel';

export type CreateFeedbackBody = {
  review_id?: string;
  case_id?: string;
  pilot_id?: string;
  decision?: string;
  ratings?: Record<string, number>;
  comment?: string;
  reviewer_id?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateFeedbackBody = {
  status?: FeedbackStatus;
  decision?: string;
  comment?: string;
  ratings?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid string field');
  }
  return value.trim() || undefined;
}

function optionalRecord(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', `Invalid field: ${field}`);
  }
  return value as Record<string, unknown>;
}

function optionalRatings(value: unknown): Record<string, number> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid field: ratings');
  }
  const ratings = value as Record<string, number>;
  validateFeedbackRatings(ratings);
  return ratings;
}

export function parseFeedbackSearchQuery(query: Record<string, unknown>): FeedbackSearchFilters {
  const filters: FeedbackSearchFilters = {};

  if (typeof query.review_id === 'string') filters.reviewId = query.review_id;
  if (typeof query.case_id === 'string') filters.caseId = query.case_id;
  if (typeof query.pilot_id === 'string') filters.pilotId = query.pilot_id;
  if (typeof query.status === 'string') {
    filters.status = assertFeedbackStatus(query.status);
  }
  if (typeof query.limit === 'string') filters.limit = Number(query.limit);
  if (typeof query.offset === 'string') filters.offset = Number(query.offset);

  return filters;
}

export function parseCreateFeedbackBody(body: unknown): CreateFeedbackBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  return {
    review_id: optionalString(record.review_id),
    case_id: optionalString(record.case_id),
    pilot_id: optionalString(record.pilot_id),
    decision: optionalString(record.decision),
    ratings: optionalRatings(record.ratings),
    comment: optionalString(record.comment),
    reviewer_id: optionalString(record.reviewer_id),
    metadata: optionalRecord(record.metadata, 'metadata'),
  };
}

export function parseUpdateFeedbackBody(body: unknown): UpdateFeedbackBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  const parsed: UpdateFeedbackBody = {};
  if (record.status !== undefined) {
    parsed.status = assertFeedbackStatus(String(record.status));
  }
  if (record.decision !== undefined) parsed.decision = optionalString(record.decision);
  if (record.comment !== undefined) parsed.comment = optionalString(record.comment);
  if (record.ratings !== undefined) parsed.ratings = optionalRatings(record.ratings);
  if (record.metadata !== undefined) {
    parsed.metadata = optionalRecord(record.metadata, 'metadata');
  }
  return parsed;
}

export { parseKosActorHeaders } from './regulation-request.js';
