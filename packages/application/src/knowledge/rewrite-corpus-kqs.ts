import { rewriteCorpusPlugin, rewriteKqsDimensions } from './corpus/rewrite-corpus.plugin.js';
import {
  scoreCorpusKqs,
  scoreEntryKqs,
  type CorpusKqs,
  type EntryKqs,
} from './platform/governance/kqs.js';
import type { RewriteCorpusEntry } from './rewrite-corpus.js';
import {
  hasConfidenceClassification,
  hasEvidenceClassification,
} from './platform/knowledge-classification.js';

export type RewriteKqsDimension =
  | 'rewrite_purpose'
  | 'rewrite_guidance'
  | 'measurable_criteria'
  | 'summary_completeness'
  | 'review_guidance_completeness'
  | 'confidence_classification'
  | 'evidence_classification'
  | 'regulation_linkage'
  | 'rule_linkage'
  | 'skill_linkage'
  | 'benchmark_refs'
  | 'expected_evidence';

export type RewriteEntryKqs = {
  rewrite_id: string;
  knowledge_id: string;
  overall: number;
  dimensions: Record<RewriteKqsDimension, number>;
};

export type RewriteCorpusKqs = {
  overall: number;
  entry_count: number;
  dimension_averages: Record<RewriteKqsDimension, number>;
  entries: RewriteEntryKqs[];
  lowest_entries: RewriteEntryKqs[];
};

function mapEntryKqs(row: EntryKqs): RewriteEntryKqs {
  return {
    rewrite_id: row.entry_key,
    knowledge_id: row.knowledge_id,
    overall: row.overall,
    dimensions: row.dimensions as Record<RewriteKqsDimension, number>,
  };
}

function mapCorpusKqs(result: CorpusKqs): RewriteCorpusKqs {
  return {
    overall: result.overall,
    entry_count: result.entry_count,
    dimension_averages: result.dimension_averages as Record<RewriteKqsDimension, number>,
    entries: result.entries.map(mapEntryKqs),
    lowest_entries: result.lowest_entries.map(mapEntryKqs),
  };
}

export function scoreRewriteEntryKqs(entry: RewriteCorpusEntry): RewriteEntryKqs {
  return mapEntryKqs(scoreEntryKqs(entry, rewriteKqsDimensions, rewriteCorpusPlugin.getEntryKey));
}

export function scoreRewriteCorpusKqs(entries: RewriteCorpusEntry[]): RewriteCorpusKqs {
  return mapCorpusKqs(scoreCorpusKqs(entries, rewriteKqsDimensions, rewriteCorpusPlugin.getEntryKey));
}

export function hasConfidenceTag(entry: RewriteCorpusEntry): boolean {
  return hasConfidenceClassification(entry);
}

export function hasEvidenceTag(entry: RewriteCorpusEntry): boolean {
  return hasEvidenceClassification(entry);
}
