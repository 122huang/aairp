export type {
  KnowledgeFreshnessBand,
  KnowledgeFreshnessStats,
} from './platform/governance/freshness.js';
export {
  ageDaysSinceReview,
  computeFreshnessBand as computeSkillFreshnessBand,
  computeFreshnessStats as computeSkillFreshnessStats,
  isStaleKnowledge,
  DEFAULT_FRESHNESS_THRESHOLDS,
} from './platform/governance/freshness.js';
