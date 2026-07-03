export type { KnowledgeEntryBase, NormalizedKnowledgeEntry } from './platform/knowledge-entry.js';
export type { KnowledgeLinkage, KnowledgeLinkageTarget } from './platform/knowledge-linkage.js';
export type { KnowledgeLifecycleStage, KnowledgeLifecycleSnapshot } from './platform/knowledge-lifecycle.js';
export type { ConfidenceLevel, EvidenceRequirement } from './platform/knowledge-classification.js';

import type { OwnerType } from './ownership.js';

/** Reserved corpus types under the Knowledge Corpus umbrella. */
export type CorpusType = 'regulation' | 'skill' | 'evidence' | 'case' | 'rewrite';

export type KnowledgeReviewStatus = 'draft' | 'legal_reviewed' | 'deprecated';

export type KnowledgeRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Shared envelope for all Knowledge Corpus entries. */
export type KnowledgeCorpusEnvelope = {
  knowledge_id: string;
  corpus_type: CorpusType;
  owner: string;
  owner_type: OwnerType;
  last_reviewed: string;
  review_status: KnowledgeReviewStatus;
  tags?: string[];
};

export type ParsedKnowledgeId = {
  corpus_type: CorpusType;
  stable_key: string;
};

const KNOWLEDGE_ID_PATTERN =
  /^(regulation|skill|evidence|case|rewrite):([a-z0-9][a-z0-9.-]*)$/;

export function buildKnowledgeId(corpusType: CorpusType, stableKey: string): string {
  return `${corpusType}:${stableKey}`;
}

export function parseKnowledgeId(knowledgeId: string): ParsedKnowledgeId | null {
  const match = KNOWLEDGE_ID_PATTERN.exec(knowledgeId);
  if (!match) {
    return null;
  }
  return {
    corpus_type: match[1] as CorpusType,
    stable_key: match[2]!,
  };
}

export function assertKnowledgeIdMatches(
  knowledgeId: string,
  corpusType: CorpusType,
  stableKey: string,
): void {
  const parsed = parseKnowledgeId(knowledgeId);
  if (!parsed) {
    throw new Error(`invalid knowledge_id format: ${knowledgeId}`);
  }
  if (parsed.corpus_type !== corpusType) {
    throw new Error(
      `knowledge_id corpus_type mismatch: expected ${corpusType}, got ${parsed.corpus_type}`,
    );
  }
  if (parsed.stable_key !== stableKey) {
    throw new Error(
      `knowledge_id stable key mismatch: expected ${stableKey}, got ${parsed.stable_key}`,
    );
  }
}
