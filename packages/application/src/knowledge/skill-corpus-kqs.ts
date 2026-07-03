import { skillCorpusPlugin, skillKqsDimensions } from './corpus/skill-corpus.plugin.js';
import {
  scoreCorpusKqs,
  scoreEntryKqs,
  type CorpusKqs,
  type EntryKqs,
} from './platform/governance/kqs.js';
import type { SkillCorpusEntry } from './skill-corpus.js';
import {
  hasConfidenceClassification,
  hasEvidenceClassification,
} from './platform/knowledge-classification.js';

export type SkillKqsDimension =
  | 'skill_purpose'
  | 'input_definition'
  | 'detection_patterns'
  | 'skill_behavior'
  | 'output_schema'
  | 'summary_completeness'
  | 'review_guidance_completeness'
  | 'confidence_classification'
  | 'evidence_classification'
  | 'regulation_linkage'
  | 'rule_linkage'
  | 'benchmark_linkage';

export type SkillEntryKqs = {
  skill_id: string;
  knowledge_id: string;
  overall: number;
  dimensions: Record<SkillKqsDimension, number>;
};

export type SkillCorpusKqs = {
  overall: number;
  entry_count: number;
  dimension_averages: Record<SkillKqsDimension, number>;
  entries: SkillEntryKqs[];
  lowest_entries: SkillEntryKqs[];
};

function mapEntryKqs(row: EntryKqs): SkillEntryKqs {
  return {
    skill_id: row.entry_key,
    knowledge_id: row.knowledge_id,
    overall: row.overall,
    dimensions: row.dimensions as Record<SkillKqsDimension, number>,
  };
}

function mapCorpusKqs(result: CorpusKqs): SkillCorpusKqs {
  return {
    overall: result.overall,
    entry_count: result.entry_count,
    dimension_averages: result.dimension_averages as Record<SkillKqsDimension, number>,
    entries: result.entries.map(mapEntryKqs),
    lowest_entries: result.lowest_entries.map(mapEntryKqs),
  };
}

export function scoreSkillEntryKqs(entry: SkillCorpusEntry): SkillEntryKqs {
  return mapEntryKqs(scoreEntryKqs(entry, skillKqsDimensions, skillCorpusPlugin.getEntryKey));
}

export function scoreSkillCorpusKqs(entries: SkillCorpusEntry[]): SkillCorpusKqs {
  return mapCorpusKqs(scoreCorpusKqs(entries, skillKqsDimensions, skillCorpusPlugin.getEntryKey));
}

export function hasConfidenceTag(entry: SkillCorpusEntry): boolean {
  return hasConfidenceClassification(entry);
}

export function hasEvidenceTag(entry: SkillCorpusEntry): boolean {
  return hasEvidenceClassification(entry);
}
