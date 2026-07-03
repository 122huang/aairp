import type { KnowledgeEntryBase } from '../knowledge-entry.js';

/** Reporting-only freshness band (shared across corpora). */
export type KnowledgeFreshnessBand = 'green' | 'yellow' | 'red';

export type KnowledgeFreshnessStats = {
  green: number;
  yellow: number;
  red: number;
  green_pct: number;
  yellow_pct: number;
  red_pct: number;
};

export type KnowledgeFreshnessThresholds = {
  greenMaxDays: number;
  yellowMaxDays: number;
};

export const DEFAULT_FRESHNESS_THRESHOLDS: KnowledgeFreshnessThresholds = {
  greenMaxDays: 180,
  yellowMaxDays: 365,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function ageDaysSinceReview(lastReviewed: string, now: Date = new Date()): number {
  const reviewedAt = new Date(lastReviewed);
  return Math.max(0, (now.getTime() - reviewedAt.getTime()) / MS_PER_DAY);
}

export function computeFreshnessBand(
  lastReviewed: string,
  now: Date = new Date(),
  thresholds: KnowledgeFreshnessThresholds = DEFAULT_FRESHNESS_THRESHOLDS,
): KnowledgeFreshnessBand {
  const ageDays = ageDaysSinceReview(lastReviewed, now);
  if (ageDays < thresholds.greenMaxDays) {
    return 'green';
  }
  if (ageDays <= thresholds.yellowMaxDays) {
    return 'yellow';
  }
  return 'red';
}

export function computeFreshnessStats<T extends KnowledgeEntryBase>(
  entries: T[],
  now: Date = new Date(),
  getLastReviewed: (entry: T) => string = (entry) => entry.last_reviewed,
  thresholds: KnowledgeFreshnessThresholds = DEFAULT_FRESHNESS_THRESHOLDS,
): KnowledgeFreshnessStats {
  const counts = { green: 0, yellow: 0, red: 0 };
  for (const entry of entries) {
    counts[computeFreshnessBand(getLastReviewed(entry), now, thresholds)] += 1;
  }
  const total = entries.length || 1;
  return {
    ...counts,
    green_pct: Math.round((counts.green / total) * 1000) / 10,
    yellow_pct: Math.round((counts.yellow / total) * 1000) / 10,
    red_pct: Math.round((counts.red / total) * 1000) / 10,
  };
}

export function isStaleKnowledge(
  lastReviewed: string,
  now: Date = new Date(),
  thresholds: KnowledgeFreshnessThresholds = DEFAULT_FRESHNESS_THRESHOLDS,
): boolean {
  return ageDaysSinceReview(lastReviewed, now) > thresholds.yellowMaxDays;
}

export function groupEntriesByFreshnessBand<T extends KnowledgeEntryBase>(
  entries: T[],
  getEntryKey: (entry: T) => string,
  now: Date = new Date(),
): Record<KnowledgeFreshnessBand, string[]> {
  const groups: Record<KnowledgeFreshnessBand, string[]> = {
    green: [],
    yellow: [],
    red: [],
  };
  for (const entry of entries) {
    const band = computeFreshnessBand(entry.last_reviewed, now);
    groups[band].push(getEntryKey(entry));
  }
  return groups;
}
