import type { ReviewDecisionResult } from '../decision/review-decision.js';
import type { ReviewReportResult } from '../report/review-report.js';

export type ReviewHappyPathResult = {
  reviewId: string;
  advertisementId: string;
  decision: ReviewDecisionResult;
  report: ReviewReportResult;
};
