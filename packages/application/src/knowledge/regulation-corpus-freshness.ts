export type {
  KnowledgeFreshnessBand,
  KnowledgeFreshnessStats,
} from './platform/governance/freshness.js';
export {
  ageDaysSinceReview,
  computeFreshnessBand as computeRegulationFreshnessBand,
  computeFreshnessStats as computeRegulationFreshnessStats,
  isStaleKnowledge,
  DEFAULT_FRESHNESS_THRESHOLDS,
} from './platform/governance/freshness.js';

/** @deprecated Use KnowledgeFreshnessBand */
export type RegulationFreshnessBand = import('./platform/governance/freshness.js').KnowledgeFreshnessBand;

/** @deprecated Use KnowledgeFreshnessStats */
export type RegulationFreshnessStats = import('./platform/governance/freshness.js').KnowledgeFreshnessStats;
