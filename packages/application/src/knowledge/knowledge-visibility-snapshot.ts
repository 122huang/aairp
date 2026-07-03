import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKnowledgePlatformSnapshot } from './platform/knowledge-platform.js';
import { buildKnowledgeGraphSnapshot, type KnowledgeGraphSnapshot } from './knowledge-graph-builder.js';
import {
  summarizeImprovementQueue,
  type ImprovementQueueSummary,
} from './knowledge-gap-report.js';
import {
  isKnowledgePackV2,
  loadKnowledgePackDraft,
  loadKnowledgePackManifest,
  type KnowledgePackV2,
} from './knowledge-pack.js';

export const DRAFT_PACK_WARNING =
  'Draft knowledge pack. Not approved for compliance use.';

export const VISIBILITY_SNAPSHOT_SCHEMA = '1.0.0';

export type VisibilityPackHeader = {
  knowledge_pack_id: string | null;
  release_status: 'released' | 'draft' | 'none';
  knowledge_pack_fingerprint: string | null;
  released_at: string | null;
  released_by: string | null;
  draft_warning: string | null;
};

export type VisibilityCorpusCard = {
  corpus_type: string;
  entry_count: number;
  knowledge_quality_score: number;
  freshness: { green: number; yellow: number; red: number };
  validation_errors: number;
  governance_warnings: number;
  fingerprint: string | null;
};

export type KnowledgeVisibilitySnapshot = {
  schema_version: typeof VISIBILITY_SNAPSHOT_SCHEMA;
  generated_at: string;
  knowledge_pack: VisibilityPackHeader;
  platform: {
    platform_version: string;
    corpora: VisibilityCorpusCard[];
    total_entries: number;
  };
  quality_vs_coverage: {
    kqs_by_corpus: Record<string, number>;
    case_benchmark_coverage_pct: number | null;
    case_benchmark_covered: number | null;
    case_benchmark_total: number | null;
    regulation_countries: string[];
  };
  dependency_graph_summary: KnowledgePackV2['dependency_graph'] | null;
  evaluation_linkage: KnowledgePackV2['evaluation_linkage'] | null;
  improvement_queue: ImprovementQueueSummary;
  graph: KnowledgeGraphSnapshot;
};

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function knowledgeUiPublicDir(): string {
  return join(repoRoot(), 'apps/knowledge-ui/public');
}

export function resolvePackForVisibility(_now: Date = new Date()): {
  pack: KnowledgePackV2 | null;
  header: VisibilityPackHeader;
} {
  const released = loadKnowledgePackManifest();
  if (released && isKnowledgePackV2(released) && released.release_status === 'released') {
    return {
      pack: released,
      header: {
        knowledge_pack_id: released.knowledge_pack_id,
        release_status: 'released',
        knowledge_pack_fingerprint: released.knowledge_pack_fingerprint,
        released_at: released.released_at ?? null,
        released_by: released.released_by ?? null,
        draft_warning: null,
      },
    };
  }

  const draft = loadKnowledgePackDraft();
  if (draft) {
    return {
      pack: draft,
      header: {
        knowledge_pack_id: draft.knowledge_pack_id,
        release_status: 'draft',
        knowledge_pack_fingerprint: draft.knowledge_pack_fingerprint,
        released_at: null,
        released_by: null,
        draft_warning: DRAFT_PACK_WARNING,
      },
    };
  }

  if (released && isKnowledgePackV2(released)) {
    return {
      pack: released,
      header: {
        knowledge_pack_id: released.knowledge_pack_id,
        release_status: released.release_status === 'released' ? 'released' : 'draft',
        knowledge_pack_fingerprint: released.knowledge_pack_fingerprint,
        released_at: released.released_at ?? null,
        released_by: released.released_by ?? null,
        draft_warning:
          released.release_status === 'released' ? null : DRAFT_PACK_WARNING,
      },
    };
  }

  return {
    pack: null,
    header: {
      knowledge_pack_id: null,
      release_status: 'none',
      knowledge_pack_fingerprint: null,
      released_at: null,
      released_by: null,
      draft_warning: DRAFT_PACK_WARNING,
    },
  };
}

export function buildKnowledgeVisibilitySnapshot(options?: {
  now?: Date;
}): KnowledgeVisibilitySnapshot {
  const now = options?.now ?? new Date();
  const platformSnapshot = buildKnowledgePlatformSnapshot(now);
  const { pack, header } = resolvePackForVisibility(now);
  const graph = buildKnowledgeGraphSnapshot();

  const corpora: VisibilityCorpusCard[] = platformSnapshot.corpora.map((corpus) => {
    const packCorpus = pack?.corpora[corpus.corpus_type as keyof typeof pack.corpora];
    return {
      corpus_type: corpus.corpus_type,
      entry_count: corpus.entry_count,
      knowledge_quality_score: corpus.knowledge_quality_score,
      freshness: corpus.freshness,
      validation_errors: corpus.validation_errors,
      governance_warnings: corpus.governance_warnings,
      fingerprint: packCorpus?.fingerprint ?? null,
    };
  });

  const kqs_by_corpus: Record<string, number> = {};
  for (const corpus of corpora) {
    kqs_by_corpus[corpus.corpus_type] = corpus.knowledge_quality_score;
  }

  const regulationCountries = new Set<string>();
  for (const node of graph.nodes) {
    if (node.country) {
      regulationCountries.add(node.country);
    }
  }

  const caseCoverage = pack?.evaluation_linkage.case_corpus.benchmark_coverage;
  const improvement_queue = summarizeImprovementQueue({ now });

  return {
    schema_version: VISIBILITY_SNAPSHOT_SCHEMA,
    generated_at: now.toISOString(),
    knowledge_pack: header,
    platform: {
      platform_version: platformSnapshot.platform_version,
      corpora,
      total_entries: corpora.reduce((sum, corpus) => sum + corpus.entry_count, 0),
    },
    quality_vs_coverage: {
      kqs_by_corpus,
      case_benchmark_coverage_pct: caseCoverage?.pct ?? null,
      case_benchmark_covered: caseCoverage?.covered ?? null,
      case_benchmark_total: caseCoverage?.total ?? null,
      regulation_countries: [...regulationCountries].sort(),
    },
    dependency_graph_summary: pack?.dependency_graph ?? null,
    evaluation_linkage: pack?.evaluation_linkage ?? null,
    improvement_queue,
    graph,
  };
}

export function writeKnowledgeVisibilitySnapshot(options?: {
  now?: Date;
  outputPath?: string;
}): KnowledgeVisibilitySnapshot {
  const snapshot = buildKnowledgeVisibilitySnapshot(options);
  const outputPath =
    options?.outputPath ?? join(knowledgeUiPublicDir(), 'knowledge-visibility.snapshot.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}
