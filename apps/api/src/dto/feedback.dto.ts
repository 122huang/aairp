import type { FeedbackRecord } from '@aairp/shared-kernel';

export type FeedbackDto = {
  feedback_id: string;
  review_id?: string;
  case_id?: string;
  pilot_id?: string;
  status: string;
  decision?: string;
  ratings: Record<string, number>;
  comment?: string;
  reviewer_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function toFeedbackDto(record: FeedbackRecord): FeedbackDto {
  return {
    feedback_id: record.feedbackId,
    review_id: record.reviewId,
    case_id: record.caseId,
    pilot_id: record.pilotId,
    status: record.status,
    decision: record.decision,
    ratings: record.ratings,
    comment: record.comment,
    reviewer_id: record.reviewerId,
    metadata: record.metadata,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}
