import type { RegulationCorpusEntry } from './regulation-corpus.js';
import { regulationCorpusPlugin, regulationKqsDimensions } from './corpus/regulation-corpus.plugin.js';
import {
  scoreCorpusKqs,
  scoreEntryKqs,
  type CorpusKqs,
  type EntryKqs,
} from './platform/governance/kqs.js';
import {
  hasConfidenceClassification,
  hasEvidenceClassification,
} from './platform/knowledge-classification.js';

export type RegulationKqsDimension =
  | 'citation_completeness'
  | 'source_quality'
  | 'summary_completeness'
  | 'review_guidance_completeness'
  | 'confidence_classification'
  | 'evidence_classification'
  | 'rule_linkage';

export type RegulationEntryKqs = {
  regulation_id: string;
  knowledge_id: string;
  overall: number;
  dimensions: Record<RegulationKqsDimension, number>;
};

export type RegulationCorpusKqs = {
  overall: number;
  entry_count: number;
  dimension_averages: Record<RegulationKqsDimension, number>;
  entries: RegulationEntryKqs[];
  lowest_entries: RegulationEntryKqs[];
};

function mapEntryKqs(row: EntryKqs): RegulationEntryKqs {
  return {
    regulation_id: row.entry_key,
    knowledge_id: row.knowledge_id,
    overall: row.overall,
    dimensions: row.dimensions as Record<RegulationKqsDimension, number>,
  };
}

function mapCorpusKqs(result: CorpusKqs): RegulationCorpusKqs {
  return {
    overall: result.overall,
    entry_count: result.entry_count,
    dimension_averages: result.dimension_averages as Record<RegulationKqsDimension, number>,
    entries: result.entries.map(mapEntryKqs),
    lowest_entries: result.lowest_entries.map(mapEntryKqs),
  };
}

export function scoreRegulationEntryKqs(entry: RegulationCorpusEntry): RegulationEntryKqs {
  return mapEntryKqs(
    scoreEntryKqs(entry, regulationKqsDimensions, regulationCorpusPlugin.getEntryKey),
  );
}

export function scoreRegulationCorpusKqs(entries: RegulationCorpusEntry[]): RegulationCorpusKqs {
  return mapCorpusKqs(
    scoreCorpusKqs(entries, regulationKqsDimensions, regulationCorpusPlugin.getEntryKey),
  );
}

export function hasConfidenceTag(entry: RegulationCorpusEntry): boolean {
  return hasConfidenceClassification(entry);
}

export function hasEvidenceTag(entry: RegulationCorpusEntry): boolean {
  return hasEvidenceClassification(entry);
}
