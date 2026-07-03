import type { KnowledgeLinkage } from '../platform/knowledge-linkage.js';
import type { RewriteCorpusEntry } from '../rewrite-corpus.js';
import { linkageCount } from '../platform/knowledge-linkage.js';

/** Map rewrite entry fields to shared KnowledgeLinkage model. */
export function rewriteEntryLinkage(entry: RewriteCorpusEntry): KnowledgeLinkage {
  return {
    regulations: [...(entry.linkage.regulations ?? [])],
    rules: [...(entry.linkage.rules ?? [])],
    skills: [...(entry.linkage.skills ?? [])],
    benchmarks: [...entry.benchmark_refs],
    cases: [...entry.case_refs],
  };
}

export function hasRewriteOutboundLinkage(entry: RewriteCorpusEntry): boolean {
  return linkageCount(rewriteEntryLinkage(entry)) > 0;
}

export function normalizeRewriteKnowledgeEntry(entry: RewriteCorpusEntry): RewriteCorpusEntry & {
  linkage: KnowledgeLinkage;
} {
  return {
    ...entry,
    linkage: rewriteEntryLinkage(entry),
  };
}
