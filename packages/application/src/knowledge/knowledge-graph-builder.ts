import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CorpusType } from './knowledge-corpus.js';
import { loadCaseCorpusEntries } from './case-corpus.js';
import { loadEvidenceCorpusEntries } from './evidence-corpus.js';
import { loadRegulationCorpusEntries } from './regulation-corpus.js';
import { loadRewriteCorpusEntries } from './rewrite-corpus.js';
import { loadSkillCorpusEntries, type SkillCorpusEntry } from './skill-corpus.js';
import { skillEntryLinkage } from './corpus/skill-entry.adapter.js';
import { evidenceEntryLinkage } from './corpus/evidence-entry.adapter.js';
import { rewriteEntryLinkage } from './corpus/rewrite-entry.adapter.js';
import { caseEntryLinkage } from './corpus/case-entry.adapter.js';
import { repoRoot } from './knowledge-pack.js';

export type KnowledgeGraphNodeCorpusType = CorpusType | 'rule';

export type KnowledgeGraphRelation =
  | 'governed_by'
  | 'linked_rule'
  | 'requires_evidence'
  | 'rewrite_guidance'
  | 'validates'
  | 'skill_link';

export type KnowledgeGraphNode = {
  id: string;
  corpus_type: KnowledgeGraphNodeCorpusType;
  label: string;
  summary: string;
  claim_types?: string[];
  country?: string;
  verification_status?: string;
  benchmark_ref?: string;
  requirement_level?: string;
  strategy?: string;
};

export type KnowledgeGraphEdge = {
  from: string;
  to: string;
  relation: KnowledgeGraphRelation;
};

export type KnowledgeGraphSnapshot = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  indexes: {
    by_claim_type: Record<string, string[]>;
    by_corpus_type: Record<string, string[]>;
    skills: Array<{ id: string; label: string; claim_types: string[] }>;
  };
};

function titleFromId(stableKey: string): string {
  return stableKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function addNode(
  map: Map<string, KnowledgeGraphNode>,
  node: KnowledgeGraphNode,
): void {
  if (!map.has(node.id)) {
    map.set(node.id, node);
  }
}

function addEdge(edges: KnowledgeGraphEdge[], edge: KnowledgeGraphEdge): void {
  if (edge.from === edge.to) {
    return;
  }
  const key = `${edge.from}|${edge.relation}|${edge.to}`;
  if (!edges.some((item) => `${item.from}|${item.relation}|${item.to}` === key)) {
    edges.push(edge);
  }
}

export function buildKnowledgeGraphSnapshot(): KnowledgeGraphSnapshot {
  const nodeMap = new Map<string, KnowledgeGraphNode>();
  const edges: KnowledgeGraphEdge[] = [];

  const rulesPack = JSON.parse(
    readFileSync(join(repoRoot(), 'demo/rules.demo.json'), 'utf8'),
  ) as { rules: Array<{ rule_id: string; summary?: string }> };
  for (const rule of rulesPack.rules) {
    addNode(nodeMap, {
      id: `rule:${rule.rule_id}`,
      corpus_type: 'rule',
      label: rule.rule_id,
      summary: rule.summary ?? rule.rule_id,
    });
  }

  for (const entry of loadRegulationCorpusEntries()) {
    addNode(nodeMap, {
      id: entry.knowledge_id,
      corpus_type: 'regulation',
      label: entry.regulation_name,
      summary: entry.summary,
      claim_types: [entry.category],
      country: entry.country,
    });
  }

  for (const entry of loadSkillCorpusEntries()) {
    addNode(nodeMap, {
      id: entry.knowledge_id,
      corpus_type: 'skill',
      label: titleFromId(entry.skill_id),
      summary: entry.summary,
      claim_types: entry.input_definition.claim_types,
    });
    const linkage = skillEntryLinkage(entry);
    for (const regulationId of linkage.regulations ?? []) {
      addEdge(edges, { from: entry.knowledge_id, to: regulationId, relation: 'governed_by' });
    }
    for (const ruleId of linkage.rules ?? []) {
      addEdge(edges, {
        from: entry.knowledge_id,
        to: `rule:${ruleId}`,
        relation: 'linked_rule',
      });
    }
    for (const evidenceId of linkage.evidence ?? []) {
      addEdge(edges, {
        from: entry.knowledge_id,
        to: evidenceId,
        relation: 'requires_evidence',
      });
    }
    for (const rewriteId of linkage.rewrites ?? []) {
      addEdge(edges, {
        from: entry.knowledge_id,
        to: rewriteId,
        relation: 'rewrite_guidance',
      });
    }
    for (const rewriteId of entry.output_schema.rewrite_linkage ?? []) {
      addEdge(edges, {
        from: entry.knowledge_id,
        to: rewriteId,
        relation: 'rewrite_guidance',
      });
    }
  }

  for (const entry of loadEvidenceCorpusEntries()) {
    addNode(nodeMap, {
      id: entry.knowledge_id,
      corpus_type: 'evidence',
      label: titleFromId(entry.evidence_id),
      summary: entry.summary,
      claim_types: entry.applicability.claim_types,
      requirement_level: entry.requirement_level,
    });
    const linkage = evidenceEntryLinkage(entry);
    for (const skillId of linkage.skills ?? []) {
      addEdge(edges, { from: skillId, to: entry.knowledge_id, relation: 'requires_evidence' });
    }
  }

  for (const entry of loadRewriteCorpusEntries()) {
    addNode(nodeMap, {
      id: entry.knowledge_id,
      corpus_type: 'rewrite',
      label: titleFromId(entry.rewrite_id),
      summary: entry.summary,
      claim_types: entry.applicability?.claim_types,
      strategy: entry.rewrite_strategy_type,
    });
    const linkage = rewriteEntryLinkage(entry);
    for (const skillId of linkage.skills ?? []) {
      addEdge(edges, { from: skillId, to: entry.knowledge_id, relation: 'rewrite_guidance' });
    }
  }

  for (const entry of loadCaseCorpusEntries()) {
    addNode(nodeMap, {
      id: entry.knowledge_id,
      corpus_type: 'case',
      label: titleFromId(entry.case_id),
      summary: entry.summary,
      claim_types: entry.scenario_spec.claim_types,
      verification_status: entry.verification_status,
      benchmark_ref: entry.benchmark_ref,
    });
    const linkage = caseEntryLinkage(entry);
    for (const skillId of linkage.skills ?? []) {
      addEdge(edges, { from: skillId, to: entry.knowledge_id, relation: 'validates' });
    }
    for (const evidenceId of linkage.evidence ?? []) {
      addEdge(edges, { from: entry.knowledge_id, to: evidenceId, relation: 'requires_evidence' });
    }
    for (const rewriteId of linkage.rewrites ?? []) {
      addEdge(edges, { from: entry.knowledge_id, to: rewriteId, relation: 'rewrite_guidance' });
    }
  }

  const by_claim_type: Record<string, string[]> = {};
  const by_corpus_type: Record<string, string[]> = {};
  for (const node of nodeMap.values()) {
    const bucket = by_corpus_type[node.corpus_type] ?? [];
    bucket.push(node.id);
    by_corpus_type[node.corpus_type] = bucket;
    for (const claimType of node.claim_types ?? []) {
      const claimBucket = by_claim_type[claimType] ?? [];
      claimBucket.push(node.id);
      by_claim_type[claimType] = claimBucket;
    }
  }

  const skills = loadSkillCorpusEntries().map((entry) => ({
    id: entry.knowledge_id,
    label: titleFromId(entry.skill_id),
    claim_types: entry.input_definition.claim_types,
  }));

  return {
    nodes: [...nodeMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges.sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`)),
    indexes: {
      by_claim_type,
      by_corpus_type,
      skills,
    },
  };
}

export function getSkillEntry(skillId: string): SkillCorpusEntry | undefined {
  return loadSkillCorpusEntries().find((entry) => entry.knowledge_id === skillId);
}
