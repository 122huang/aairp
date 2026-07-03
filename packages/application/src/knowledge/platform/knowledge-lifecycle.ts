import type { KnowledgeReviewStatus } from '../knowledge-corpus.js';

/**
 * Unified knowledge lifecycle stages (reporting and governance).
 * Maps legacy review_status values until all corpora migrate.
 */
export type KnowledgeLifecycleStage =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'eval_due'
  | 'retired'
  | 'archived';

export const KNOWLEDGE_LIFECYCLE_STAGES: KnowledgeLifecycleStage[] = [
  'draft',
  'in_review',
  'approved',
  'published',
  'eval_due',
  'retired',
  'archived',
];

export function mapReviewStatusToLifecycle(
  reviewStatus: KnowledgeReviewStatus,
): KnowledgeLifecycleStage {
  switch (reviewStatus) {
    case 'draft':
      return 'draft';
    case 'legal_reviewed':
      return 'approved';
    case 'deprecated':
      return 'retired';
    default:
      return 'draft';
  }
}

export function isPublishedStage(stage: KnowledgeLifecycleStage): boolean {
  return stage === 'published' || stage === 'approved';
}

export function isActiveStage(stage: KnowledgeLifecycleStage): boolean {
  return stage !== 'retired' && stage !== 'archived';
}

export type KnowledgeLifecycleSnapshot = {
  stage: KnowledgeLifecycleStage;
  legacy_review_status: KnowledgeReviewStatus;
  is_active: boolean;
};

export function snapshotLifecycle(reviewStatus: KnowledgeReviewStatus): KnowledgeLifecycleSnapshot {
  const stage = mapReviewStatusToLifecycle(reviewStatus);
  return {
    stage,
    legacy_review_status: reviewStatus,
    is_active: isActiveStage(stage),
  };
}
