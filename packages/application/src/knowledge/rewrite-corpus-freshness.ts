export type {
  KnowledgeFreshnessBand,
  KnowledgeFreshnessStats,
} from './platform/governance/freshness.js';
export {
  ageDaysSinceReview,
  computeFreshnessBand as computeRewriteFreshnessBand,
  computeFreshnessStats as computeRewriteFreshnessStats,
  isStaleKnowledge,
  DEFAULT_FRESHNESS_THRESHOLDS,
} from './platform/governance/freshness.js';
