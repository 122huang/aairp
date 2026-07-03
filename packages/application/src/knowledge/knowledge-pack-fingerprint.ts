import { createHash } from 'node:crypto';
import type { CorpusType } from './knowledge-corpus.js';
import type { KnowledgePackV2Body } from './knowledge-pack.js';

const CORPUS_ORDER: CorpusType[] = ['regulation', 'skill', 'rewrite', 'evidence', 'case'];

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}

export function fingerprintBody(body: KnowledgePackV2Body): string {
  const corpora: Record<string, unknown> = {};
  for (const corpusType of CORPUS_ORDER) {
    const snapshot = body.corpora[corpusType];
    corpora[corpusType] = {
      fingerprint: snapshot.fingerprint,
      entry_count: snapshot.entry_count,
      schema_version: snapshot.schema_version,
    };
  }

  const payload = {
    platform_version: body.platform_version,
    corpora,
    runtime_components: body.runtime_components,
    evaluation_linkage: {
      benchmark: {
        content_fingerprint: body.evaluation_linkage.benchmark.content_fingerprint,
        schema_version: body.evaluation_linkage.benchmark.schema_version,
      },
      case_corpus: {
        fingerprint: body.evaluation_linkage.case_corpus.fingerprint,
        entry_count: body.evaluation_linkage.case_corpus.entry_count,
      },
      regression_baseline_ref: body.evaluation_linkage.regression_baseline_ref,
    },
    dependency_graph: {
      orphan_counts: body.dependency_graph.orphan_counts,
    },
    compatibility: body.compatibility,
  };

  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function attachFingerprint(body: KnowledgePackV2Body): {
  knowledge_pack_fingerprint: string;
} & KnowledgePackV2Body {
  return {
    ...body,
    knowledge_pack_fingerprint: fingerprintBody(body),
  };
}
