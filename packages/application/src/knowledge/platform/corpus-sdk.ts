import type { CorpusType } from '../knowledge-corpus.js';
import type { KnowledgeEntryBase } from './knowledge-entry.js';
import type { KnowledgeLinkage } from './knowledge-linkage.js';
import type { CorpusCoverageReport } from './governance/coverage.js';
import type { ValidationResult } from './governance/validator.js';
import type { KnowledgeFreshnessStats } from './governance/freshness.js';
import type { KqsDimensionDef } from './governance/kqs.js';

export type CorpusLoadBundle<T extends KnowledgeEntryBase> = {
  root: string;
  entries: T[];
};

export type CorpusManifest = {
  schema_version: string;
  platform_version: string;
  corpus_type: CorpusType;
  generated_at: string;
  corpus_root: string;
  fingerprint: string;
  entry_count: number;
  knowledge_quality_score: number;
  freshness: KnowledgeFreshnessStats;
  knowledge_ids: string[];
  dimensions: Record<string, unknown>;
  manifest_filename: string;
  metadata?: Record<string, unknown>;
};

export type KnowledgeCorpusPlugin<T extends KnowledgeEntryBase> = {
  corpus_type: CorpusType;
  platform_version: string;
  dashboardTitle: string;
  coverageTitle: string;
  manifest_filename: string;
  load: (customRoot?: string) => CorpusLoadBundle<T>;
  getEntryKey: (entry: T) => string;
  getLinkage: (entry: T) => KnowledgeLinkage;
  kqsDimensions: KqsDimensionDef<T>[];
  buildCoverage: (entries: T[], now: Date) => CorpusCoverageReport;
  buildManifest: (entries: T[], root: string, now: Date) => CorpusManifest;
  validate: (entries: T[], context: { now: Date; knownRuleIds?: Set<string> }) => ValidationResult;
  knownRuleIds?: () => Set<string>;
  defaultReportsDir: () => string;
  fingerprintEntry: (entry: T) => string;
};

export const KNOWLEDGE_PLATFORM_VERSION = '1.0.0';

export type KnowledgePlatformSnapshot = {
  platform_version: string;
  generated_at: string;
  corpora: Array<{
    corpus_type: CorpusType;
    entry_count: number;
    knowledge_quality_score: number;
    freshness: KnowledgeFreshnessStats;
    validation_errors: number;
    governance_warnings: number;
  }>;
};
