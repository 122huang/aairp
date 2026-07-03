import type { KnowledgeLinkage } from '../platform/knowledge-linkage.js';
import type { EvidenceCorpusEntry } from '../evidence-corpus.js';
import { linkageCount } from '../platform/knowledge-linkage.js';

/** Map evidence entry fields to shared KnowledgeLinkage model. */
export function evidenceEntryLinkage(entry: EvidenceCorpusEntry): KnowledgeLinkage {
  return {
    regulations: [...(entry.linkage.regulations ?? [])],
    rules: [...(entry.linkage.rules ?? [])],
    skills: [...(entry.linkage.skills ?? [])],
    rewrites: [...(entry.linkage.rewrites ?? [])],
    benchmarks: [...(entry.benchmark_refs ?? [])],
    cases: [...(entry.case_refs ?? [])],
  };
}

export function hasEvidenceOutboundLinkage(entry: EvidenceCorpusEntry): boolean {
  return linkageCount(evidenceEntryLinkage(entry)) > 0;
}

export function normalizeEvidenceKnowledgeEntry(entry: EvidenceCorpusEntry): EvidenceCorpusEntry & {
  linkage: KnowledgeLinkage;
} {
  return {
    ...entry,
    linkage: evidenceEntryLinkage(entry),
  };
}
