export type OwnerType = 'legal' | 'knowledge_eng' | 'compliance' | 'product';

export type FreshnessStatus = 'current' | 'review_due' | 'stale' | 'deprecated';

export type OwnershipMetadata = {
  owner: string;
  owner_type: OwnerType;
  last_reviewed_at: string;
  freshness_status: FreshnessStatus;
};

export type FreshnessInput = {
  lastReviewedAt: string | Date;
  evalPassed?: boolean;
  now?: Date;
  reviewDueDays?: number;
  staleDays?: number;
};

const DEFAULT_REVIEW_DUE_DAYS = 90;
const DEFAULT_STALE_DAYS = 180;

export function computeFreshnessStatus(input: FreshnessInput): FreshnessStatus {
  const now = input.now ?? new Date();
  const reviewedAt =
    input.lastReviewedAt instanceof Date
      ? input.lastReviewedAt
      : new Date(input.lastReviewedAt);
  const ageMs = now.getTime() - reviewedAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const reviewDueDays = input.reviewDueDays ?? DEFAULT_REVIEW_DUE_DAYS;
  const staleDays = input.staleDays ?? DEFAULT_STALE_DAYS;

  if (ageDays > staleDays) {
    return 'stale';
  }
  if (ageDays > reviewDueDays || input.evalPassed === false) {
    return 'review_due';
  }
  return 'current';
}
