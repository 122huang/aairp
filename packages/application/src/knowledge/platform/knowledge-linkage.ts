import type { CorpusType } from '../knowledge-corpus.js';

/**
 * Structured cross-corpus linkage. Prefer knowledge_id references.
 * Rule IDs remain supported where runtime packs have not migrated to knowledge_id.
 */
export type KnowledgeLinkage = {
  regulations?: string[];
  rules?: string[];
  skills?: string[];
  evidence?: string[];
  cases?: string[];
  rewrites?: string[];
  benchmarks?: string[];
};

export type KnowledgeLinkageTarget = keyof KnowledgeLinkage;

export const KNOWLEDGE_LINKAGE_TARGETS: KnowledgeLinkageTarget[] = [
  'regulations',
  'rules',
  'skills',
  'evidence',
  'cases',
  'rewrites',
  'benchmarks',
];

export function emptyKnowledgeLinkage(): KnowledgeLinkage {
  return {};
}

export function mergeKnowledgeLinkage(
  base: KnowledgeLinkage,
  patch: KnowledgeLinkage,
): KnowledgeLinkage {
  const merged: KnowledgeLinkage = { ...base };
  for (const key of KNOWLEDGE_LINKAGE_TARGETS) {
    const values = [...(merged[key] ?? []), ...(patch[key] ?? [])];
    if (values.length > 0) {
      merged[key] = [...new Set(values)];
    }
  }
  return merged;
}

export function linkageCount(linkage: KnowledgeLinkage): number {
  return KNOWLEDGE_LINKAGE_TARGETS.reduce((sum, key) => sum + (linkage[key]?.length ?? 0), 0);
}

export function hasLinkageTarget(
  linkage: KnowledgeLinkage,
  target: KnowledgeLinkageTarget,
): boolean {
  return (linkage[target]?.length ?? 0) > 0;
}

/** True when entry has no outbound links (governance warning candidate). */
export function isOrphanLinkage(linkage: KnowledgeLinkage, requiredTargets?: KnowledgeLinkageTarget[]): boolean {
  if (requiredTargets && requiredTargets.length > 0) {
    return requiredTargets.every((target) => !hasLinkageTarget(linkage, target));
  }
  return linkageCount(linkage) === 0;
}

export function knowledgeIdsForCorpusType(
  linkage: KnowledgeLinkage,
  corpusType: CorpusType,
): string[] {
  switch (corpusType) {
    case 'regulation':
      return linkage.regulations ?? [];
    case 'skill':
      return linkage.skills ?? [];
    case 'evidence':
      return linkage.evidence ?? [];
    case 'case':
      return linkage.cases ?? [];
    case 'rewrite':
      return linkage.rewrites ?? [];
    default:
      return [];
  }
}

export function ruleIds(linkage: KnowledgeLinkage): string[] {
  return linkage.rules ?? [];
}
