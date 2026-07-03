import type { KnowledgeLinkage } from '../platform/knowledge-linkage.js';
import type { CaseCorpusEntry } from '../case-corpus.js';
import { linkageCount } from '../platform/knowledge-linkage.js';

export function caseEntryLinkage(entry: CaseCorpusEntry): KnowledgeLinkage {
  return {
    regulations: [...(entry.linkage.regulations ?? [])],
    rules: [...(entry.linkage.rules ?? [])],
    skills: [...(entry.linkage.skills ?? [])],
    evidence: [...(entry.linkage.evidence ?? [])],
    rewrites: [...(entry.linkage.rewrites ?? [])],
    benchmarks: entry.benchmark_ref ? [entry.benchmark_ref] : [],
  };
}

export function hasCaseOutboundLinkage(entry: CaseCorpusEntry): boolean {
  return linkageCount(caseEntryLinkage(entry)) > 0;
}

export function normalizeCaseKnowledgeEntry(entry: CaseCorpusEntry): CaseCorpusEntry & {
  linkage: KnowledgeLinkage;
} {
  return {
    ...entry,
    linkage: caseEntryLinkage(entry),
  };
}
