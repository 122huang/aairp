import type { OwnerType } from '../ownership.js';
import type { CorpusType, KnowledgeCorpusEnvelope } from '../knowledge-corpus.js';
import type { KnowledgeLinkage } from './knowledge-linkage.js';
import type { ConfidenceLevel, EvidenceRequirement } from './knowledge-classification.js';

/**
 * Shared KnowledgeEntry base model — extended by every corpus type.
 * Regulation, Skill, Evidence, Rewrite, and Case entries MUST include these fields
 * (or map to them via corpus plugins).
 */
export type KnowledgeEntryBase = KnowledgeCorpusEnvelope & {
  summary: string;
  review_guidance: string;
  /** Promoted from tags when absent on disk (backward compatible). */
  confidence_level?: ConfidenceLevel;
  evidence_requirement?: EvidenceRequirement;
  /** Structured cross-corpus links (derived or authored). */
  linkage?: KnowledgeLinkage;
};

export type NormalizedKnowledgeEntry = KnowledgeEntryBase & {
  confidence_level: ConfidenceLevel;
  evidence_requirement: EvidenceRequirement;
  linkage: KnowledgeLinkage;
};

export function isKnowledgeEntryBase(value: unknown): value is KnowledgeEntryBase {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.knowledge_id === 'string' &&
    typeof entry.corpus_type === 'string' &&
    typeof entry.summary === 'string' &&
    typeof entry.review_guidance === 'string'
  );
}

export type KnowledgeEntryOwnership = {
  owner: string;
  owner_type: OwnerType;
  last_reviewed: string;
};

export function extractOwnership(entry: KnowledgeEntryBase): KnowledgeEntryOwnership {
  return {
    owner: entry.owner,
    owner_type: entry.owner_type,
    last_reviewed: entry.last_reviewed,
  };
}

export function corpusTypeOf(entry: KnowledgeEntryBase): CorpusType {
  return entry.corpus_type;
}
