import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertKnowledgeIdMatches,
  type CorpusType,
  type KnowledgeCorpusEnvelope,
} from './knowledge-corpus.js';
import type { KnowledgeLinkage } from './platform/knowledge-linkage.js';
import type { ConfidenceLevel, EvidenceRequirement } from './platform/knowledge-classification.js';

export type RewriteCorpusStatus = 'draft' | 'validated' | 'production' | 'deprecated';

export const REWRITE_CORPUS_STATUSES: RewriteCorpusStatus[] = [
  'draft',
  'validated',
  'production',
  'deprecated',
];

export const ACTIVE_REWRITE_STATUSES: RewriteCorpusStatus[] = ['validated', 'production'];

export type RewriteStrategyType = 'qualify' | 'remove' | 'disclose' | 'cite_evidence';

export const REWRITE_STRATEGY_TYPES: RewriteStrategyType[] = [
  'qualify',
  'remove',
  'disclose',
  'cite_evidence',
];

export type ExpectedEvidenceType =
  | 'none'
  | 'certification'
  | 'lab_report'
  | 'substantiation_general'
  | 'test_method';

export const EXPECTED_EVIDENCE_TYPES: ExpectedEvidenceType[] = [
  'none',
  'certification',
  'lab_report',
  'substantiation_general',
  'test_method',
];

export type RewriteMeasurableCriteria = {
  must_remove_terms: string[];
  must_include_concepts: string[];
  scoring_notes?: string;
};

export type RewriteApplicability = {
  countries?: string[];
  modalities?: string[];
  claim_types?: string[];
};

export type RewriteCorpusLinkage = {
  regulations?: string[];
  rules?: string[];
  skills?: string[];
};

export type RewriteCorpusEntry = KnowledgeCorpusEnvelope & {
  corpus_type: 'rewrite';
  rewrite_id: string;
  legacy_template_id?: string;
  rewrite_purpose: string;
  rewrite_status: RewriteCorpusStatus;
  rewrite_version: string;
  rewrite_strategy_type: RewriteStrategyType;
  rewrite_guidance: string;
  measurable_criteria: RewriteMeasurableCriteria;
  benchmark_refs: string[];
  case_refs: string[];
  summary: string;
  review_guidance: string;
  linkage: RewriteCorpusLinkage;
  applicability?: RewriteApplicability;
  rewrite_linkage_scope?: 'independent';
  rewrite_independence_rationale?: string;
  regulation_scope?: 'independent';
  regulation_independence_rationale?: string;
  expected_evidence_type?: ExpectedEvidenceType;
  evidence_requirement?: EvidenceRequirement;
  confidence_level?: ConfidenceLevel;
};

export type RewriteStrategyDef = {
  strategy_type: RewriteStrategyType;
  name: string;
  description: string;
};

export type ExpectedEvidenceTypeDef = {
  evidence_type: ExpectedEvidenceType;
  description: string;
};

export type RewriteStrategiesDocument = {
  schema_version: string;
  description: string;
  rewrite_strategy_types: RewriteStrategyDef[];
  expected_evidence_types: ExpectedEvidenceTypeDef[];
};

export type RewriteCorpusLoadResult = {
  root: string;
  strategies: RewriteStrategiesDocument;
  entries: RewriteCorpusEntry[];
};

const defaultCorpusRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/knowledge/rewrite-corpus',
);

export function resolveRewriteCorpusRoot(customRoot?: string): string {
  if (customRoot) {
    return customRoot;
  }
  if (process.env.AAIRP_REWRITE_CORPUS_PATH) {
    return process.env.AAIRP_REWRITE_CORPUS_PATH;
  }
  return defaultCorpusRoot;
}

export function loadRewriteStrategies(customRoot?: string): RewriteStrategiesDocument {
  const root = resolveRewriteCorpusRoot(customRoot);
  return JSON.parse(
    readFileSync(join(root, 'rewrite-strategies.json'), 'utf8'),
  ) as RewriteStrategiesDocument;
}

export function isActiveRewriteStatus(status: RewriteCorpusStatus): boolean {
  return ACTIVE_REWRITE_STATUSES.includes(status);
}

export function isIndependentRewriteLinkage(entry: RewriteCorpusEntry): boolean {
  return entry.rewrite_linkage_scope === 'independent';
}

export function requiresRegulationLinkage(entry: RewriteCorpusEntry): boolean {
  if (entry.rewrite_status === 'deprecated') {
    return false;
  }
  if (entry.regulation_scope === 'independent') {
    return false;
  }
  return isActiveRewriteStatus(entry.rewrite_status);
}

export function requiresSkillLinkage(entry: RewriteCorpusEntry): boolean {
  if (entry.rewrite_status === 'deprecated') {
    return false;
  }
  if (isIndependentRewriteLinkage(entry)) {
    return false;
  }
  return isActiveRewriteStatus(entry.rewrite_status);
}

export function normalizeRewriteCorpusEntry(raw: RewriteCorpusEntry): RewriteCorpusEntry {
  assertKnowledgeIdMatches(raw.knowledge_id, 'rewrite', raw.rewrite_id);
  if (raw.corpus_type !== 'rewrite') {
    throw new Error(`expected corpus_type rewrite, got ${raw.corpus_type}`);
  }
  if (!REWRITE_CORPUS_STATUSES.includes(raw.rewrite_status)) {
    throw new Error(`unsupported rewrite_status: ${raw.rewrite_status}`);
  }
  if (!REWRITE_STRATEGY_TYPES.includes(raw.rewrite_strategy_type)) {
    throw new Error(`unsupported rewrite_strategy_type: ${raw.rewrite_strategy_type}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(raw.rewrite_version)) {
    throw new Error(`invalid rewrite_version semver: ${raw.rewrite_version}`);
  }
  if (raw.benchmark_refs.length === 0) {
    throw new Error(`rewrite ${raw.rewrite_id} must have at least one benchmark_ref`);
  }
  if (!Array.isArray(raw.case_refs)) {
    throw new Error(`rewrite ${raw.rewrite_id} must include case_refs array`);
  }
  for (const caseRef of raw.case_refs) {
    if (!caseRef.startsWith('case:')) {
      throw new Error(`case_refs must use case: prefix: ${caseRef}`);
    }
  }
  if (raw.rewrite_linkage_scope === 'independent' && !raw.rewrite_independence_rationale?.trim()) {
    throw new Error(
      `rewrite ${raw.rewrite_id} with rewrite_linkage_scope independent requires rewrite_independence_rationale`,
    );
  }
  if (raw.regulation_scope === 'independent' && !raw.regulation_independence_rationale?.trim()) {
    throw new Error(
      `rewrite ${raw.rewrite_id} with regulation_scope independent requires regulation_independence_rationale`,
    );
  }
  for (const regulationId of raw.linkage.regulations ?? []) {
    if (!regulationId.startsWith('regulation:')) {
      throw new Error(`linkage.regulations must use regulation: prefix: ${regulationId}`);
    }
  }
  for (const skillId of raw.linkage.skills ?? []) {
    if (!skillId.startsWith('skill:')) {
      throw new Error(`linkage.skills must use skill: prefix: ${skillId}`);
    }
  }
  if (raw.rewrite_strategy_type === 'cite_evidence') {
    if (!raw.expected_evidence_type || raw.expected_evidence_type === 'none') {
      throw new Error(
        `rewrite ${raw.rewrite_id} with cite_evidence strategy requires expected_evidence_type other than none`,
      );
    }
    if (raw.evidence_requirement !== 'required') {
      throw new Error(
        `rewrite ${raw.rewrite_id} with cite_evidence strategy requires evidence_requirement required`,
      );
    }
  }
  return raw;
}

export function loadRewriteCorpusEntry(filePath: string): RewriteCorpusEntry {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as RewriteCorpusEntry;
  return normalizeRewriteCorpusEntry(raw);
}

function listRewriteJsonFiles(rewritesDir: string): string[] {
  if (!existsSync(rewritesDir)) {
    return [];
  }
  return readdirSync(rewritesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(rewritesDir, entry.name));
}

export function loadRewriteCorpusEntries(customRoot?: string): RewriteCorpusEntry[] {
  const root = resolveRewriteCorpusRoot(customRoot);
  const rewritesDir = join(root, 'rewrites');
  const entries: RewriteCorpusEntry[] = [];

  for (const filePath of listRewriteJsonFiles(rewritesDir)) {
    entries.push(loadRewriteCorpusEntry(filePath));
  }

  return entries.sort((a, b) => a.rewrite_id.localeCompare(b.rewrite_id));
}

export function loadRewriteCorpus(customRoot?: string): RewriteCorpusLoadResult {
  const root = resolveRewriteCorpusRoot(customRoot);
  return {
    root,
    strategies: loadRewriteStrategies(root),
    entries: loadRewriteCorpusEntries(root),
  };
}

export function isRewriteCorpusType(corpusType: CorpusType): corpusType is 'rewrite' {
  return corpusType === 'rewrite';
}

export function rewriteKnowledgeId(rewriteId: string): string {
  return `rewrite:${rewriteId}`;
}

export type { KnowledgeLinkage };
