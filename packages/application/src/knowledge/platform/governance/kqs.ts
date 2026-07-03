import type { KnowledgeEntryBase } from '../knowledge-entry.js';
import {
  resolveConfidenceLevel,
  resolveEvidenceRequirement,
  scoreConfidenceLevel,
  scoreEvidenceRequirement,
} from '../knowledge-classification.js';

export type KqsDimensionId = string;

export type KqsDimensionDef<T extends KnowledgeEntryBase> = {
  id: KqsDimensionId;
  label: string;
  score: (entry: T) => number;
};

export type EntryKqs = {
  entry_key: string;
  knowledge_id: string;
  overall: number;
  dimensions: Record<KqsDimensionId, number>;
};

export type CorpusKqs = {
  overall: number;
  entry_count: number;
  dimension_averages: Record<KqsDimensionId, number>;
  entries: EntryKqs[];
  lowest_entries: EntryKqs[];
};

function toPercent(score: number): number {
  return Math.round(score * 1000) / 10;
}

export function scoreSharedSummaryCompleteness(summary: string | undefined): number {
  const text = summary?.trim() ?? '';
  if (!text) {
    return 0;
  }
  if (text.length >= 50 && text.length <= 400) {
    return 1;
  }
  if (text.length >= 25) {
    return 0.75;
  }
  return 0.4;
}

export function scoreSharedReviewGuidanceCompleteness(guidance: string | undefined): number {
  const text = guidance?.trim() ?? '';
  if (!text) {
    return 0;
  }
  const upper = text.toUpperCase();
  if (upper.includes('TRIGGER') && upper.includes('ACTION') && upper.includes('CHECK')) {
    return 1;
  }
  if (text.length >= 40) {
    return 0.5;
  }
  return 0.2;
}

export function sharedClassificationDimensions<T extends KnowledgeEntryBase>(): KqsDimensionDef<T>[] {
  return [
    {
      id: 'summary_completeness',
      label: 'Summary completeness',
      score: (entry) => scoreSharedSummaryCompleteness(entry.summary),
    },
    {
      id: 'review_guidance_completeness',
      label: 'Review guidance completeness',
      score: (entry) => scoreSharedReviewGuidanceCompleteness(entry.review_guidance),
    },
    {
      id: 'confidence_classification',
      label: 'Confidence classification',
      score: (entry) => scoreConfidenceLevel(resolveConfidenceLevel(entry)),
    },
    {
      id: 'evidence_classification',
      label: 'Evidence classification',
      score: (entry) => scoreEvidenceRequirement(resolveEvidenceRequirement(entry)),
    },
  ];
}

export function scoreEntryKqs<T extends KnowledgeEntryBase>(
  entry: T,
  dimensions: KqsDimensionDef<T>[],
  getEntryKey: (entry: T) => string,
): EntryKqs {
  const dimensionScores = {} as Record<KqsDimensionId, number>;
  const rawScores: number[] = [];
  for (const dimension of dimensions) {
    const raw = dimension.score(entry);
    rawScores.push(raw);
    dimensionScores[dimension.id] = toPercent(raw);
  }
  const overall =
    rawScores.length === 0
      ? 0
      : Math.round((rawScores.reduce((sum, value) => sum + value, 0) / rawScores.length) * 1000) / 10;
  return {
    entry_key: getEntryKey(entry),
    knowledge_id: entry.knowledge_id,
    overall,
    dimensions: dimensionScores,
  };
}

export function scoreCorpusKqs<T extends KnowledgeEntryBase>(
  entries: T[],
  dimensions: KqsDimensionDef<T>[],
  getEntryKey: (entry: T) => string,
): CorpusKqs {
  const scored = entries.map((entry) => scoreEntryKqs(entry, dimensions, getEntryKey));
  const dimensionIds = dimensions.map((dimension) => dimension.id);
  const dimension_averages = {} as Record<KqsDimensionId, number>;
  for (const id of dimensionIds) {
    const avg =
      scored.length === 0
        ? 0
        : scored.reduce((sum, row) => sum + row.dimensions[id]!, 0) / scored.length;
    dimension_averages[id] = Math.round(avg * 10) / 10;
  }
  const overall =
    scored.length === 0
      ? 0
      : Math.round((scored.reduce((sum, row) => sum + row.overall, 0) / scored.length) * 10) / 10;
  return {
    overall,
    entry_count: scored.length,
    dimension_averages,
    entries: scored,
    lowest_entries: [...scored].sort((a, b) => a.overall - b.overall).slice(0, 5),
  };
}
