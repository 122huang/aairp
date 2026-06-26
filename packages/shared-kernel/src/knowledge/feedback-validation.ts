import type { FeedbackStatus } from './feedback.js';

export type FeedbackRatingValidationIssue = {
  field: string;
  message: string;
};

export class FeedbackValidationError extends Error {
  constructor(public readonly issues: FeedbackRatingValidationIssue[]) {
    super(issues.map((issue) => issue.message).join('; '));
    this.name = 'FeedbackValidationError';
  }
}

export function validateFeedbackRatings(ratings: Record<string, number>): void {
  const issues: FeedbackRatingValidationIssue[] = [];

  for (const [field, value] of Object.entries(ratings)) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      issues.push({
        field,
        message: `Rating ${field} must be an integer from 1 to 5`,
      });
    }
  }

  if (issues.length > 0) {
    throw new FeedbackValidationError(issues);
  }
}

export function assertFeedbackStatus(status: string): FeedbackStatus {
  if (status === 'open' || status === 'triaged' || status === 'closed') {
    return status;
  }
  throw new FeedbackValidationError([
    { field: 'status', message: 'status must be open, triaged, or closed' },
  ]);
}
