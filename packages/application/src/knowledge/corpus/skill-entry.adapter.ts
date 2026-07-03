import type { KnowledgeLinkage } from '../platform/knowledge-linkage.js';
import type { SkillCorpusEntry } from '../skill-corpus.js';
import { linkageCount } from '../platform/knowledge-linkage.js';

/** Map skill entry fields to shared KnowledgeLinkage model. */
export function skillEntryLinkage(entry: SkillCorpusEntry): KnowledgeLinkage {
  return {
    regulations: [...(entry.linkage.regulations ?? [])],
    rules: [...(entry.linkage.rules ?? [])],
    skills: [...(entry.linkage.skills ?? [])],
    evidence: [...(entry.linkage.evidence ?? [])],
    cases: [...(entry.linkage.cases ?? [])],
    rewrites: [...(entry.linkage.rewrites ?? [])],
    benchmarks: [...(entry.linkage.benchmarks ?? [])],
  };
}

export function hasSkillOutboundLinkage(entry: SkillCorpusEntry): boolean {
  return linkageCount(skillEntryLinkage(entry)) > 0;
}

export function normalizeSkillKnowledgeEntry(entry: SkillCorpusEntry): SkillCorpusEntry & {
  linkage: KnowledgeLinkage;
} {
  return {
    ...entry,
    linkage: skillEntryLinkage(entry),
  };
}
