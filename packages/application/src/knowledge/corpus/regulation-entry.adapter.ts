import type { KnowledgeLinkage } from '../platform/knowledge-linkage.js';
import type { RegulationCorpusEntry } from '../regulation-corpus.js';

/** Map regulation entry fields to shared KnowledgeLinkage model. */
export function regulationEntryLinkage(entry: RegulationCorpusEntry): KnowledgeLinkage {
  return {
    regulations: [entry.knowledge_id],
    rules: [...entry.related_rule_ids],
    evidence: [...entry.related_evidence_ids],
  };
}

export function hasRegulationOutboundLinkage(entry: RegulationCorpusEntry): boolean {
  return (
    entry.related_rule_ids.length > 0 ||
    entry.pending_rule_ids.length > 0 ||
    entry.related_evidence_ids.length > 0
  );
}

export function normalizeRegulationKnowledgeEntry(entry: RegulationCorpusEntry): RegulationCorpusEntry & {
  linkage: KnowledgeLinkage;
} {
  return {
    ...entry,
    linkage: regulationEntryLinkage(entry),
  };
}
