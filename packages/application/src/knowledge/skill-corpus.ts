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

export type SkillCorpusStatus = 'draft' | 'validated' | 'production' | 'deprecated';

export const SKILL_CORPUS_STATUSES: SkillCorpusStatus[] = [
  'draft',
  'validated',
  'production',
  'deprecated',
];

export const ACTIVE_SKILL_STATUSES: SkillCorpusStatus[] = ['validated', 'production'];

export type SkillInputDefinition = {
  modalities: string[];
  countries: string[];
  categories: string[];
  claim_types: string[];
  required_context?: string[];
};

export type SkillDetectionPattern = {
  pattern_id: string;
  description: string;
  signal_terms?: string[];
  signal_concepts?: string[];
  playbook_pattern_id?: string;
  rewrite_template_id?: string;
};

export type SkillBehavior = {
  rewrite_strategy?: 'qualify' | 'remove' | 'disclose' | 'cite_evidence';
  checkpoint_actions?: string[];
  escalation_hints?: string[];
};

export type SkillOutputSchema = {
  fields: string[];
  rewrite_linkage?: string[];
};

export type SkillCorpusEntry = KnowledgeCorpusEnvelope & {
  corpus_type: 'skill';
  skill_id: string;
  skill_purpose: string;
  skill_status: SkillCorpusStatus;
  skill_version: string;
  summary: string;
  review_guidance: string;
  input_definition: SkillInputDefinition;
  detection_patterns: SkillDetectionPattern[];
  skill_behavior: SkillBehavior;
  output_schema: SkillOutputSchema;
  linkage: KnowledgeLinkage;
  regulation_scope?: 'independent';
  regulation_independence_rationale?: string;
  legacy_skill_module?: string;
  legacy_pattern_ids?: string[];
  confidence_level?: ConfidenceLevel;
  evidence_requirement?: EvidenceRequirement;
};

export type SkillClaimTypeDef = {
  claim_type_id: string;
  name: string;
  description: string;
};

export type SkillClaimTypesDocument = {
  schema_version: string;
  description: string;
  claim_types: SkillClaimTypeDef[];
};

export type SkillCorpusLoadResult = {
  root: string;
  claim_types: SkillClaimTypesDocument;
  entries: SkillCorpusEntry[];
};

const defaultCorpusRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/knowledge/skill-corpus',
);

export function resolveSkillCorpusRoot(customRoot?: string): string {
  if (customRoot) {
    return customRoot;
  }
  if (process.env.AAIRP_SKILL_CORPUS_PATH) {
    return process.env.AAIRP_SKILL_CORPUS_PATH;
  }
  return defaultCorpusRoot;
}

export function loadSkillClaimTypes(customRoot?: string): SkillClaimTypesDocument {
  const root = resolveSkillCorpusRoot(customRoot);
  return JSON.parse(
    readFileSync(join(root, 'skill-claim-types.json'), 'utf8'),
  ) as SkillClaimTypesDocument;
}

export function isActiveSkillStatus(status: SkillCorpusStatus): boolean {
  return ACTIVE_SKILL_STATUSES.includes(status);
}

export function requiresRegulationLinkage(entry: SkillCorpusEntry): boolean {
  if (entry.skill_status === 'deprecated') {
    return false;
  }
  if (entry.regulation_scope === 'independent') {
    return false;
  }
  return isActiveSkillStatus(entry.skill_status);
}

export function normalizeSkillCorpusEntry(raw: SkillCorpusEntry): SkillCorpusEntry {
  assertKnowledgeIdMatches(raw.knowledge_id, 'skill', raw.skill_id);
  if (raw.corpus_type !== 'skill') {
    throw new Error(`expected corpus_type skill, got ${raw.corpus_type}`);
  }
  if (!SKILL_CORPUS_STATUSES.includes(raw.skill_status)) {
    throw new Error(`unsupported skill_status: ${raw.skill_status}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(raw.skill_version)) {
    throw new Error(`invalid skill_version semver: ${raw.skill_version}`);
  }
  if (raw.detection_patterns.length === 0) {
    throw new Error(`skill ${raw.skill_id} must have at least one detection_pattern`);
  }
  if (raw.regulation_scope === 'independent' && !raw.regulation_independence_rationale?.trim()) {
    throw new Error(
      `skill ${raw.skill_id} with regulation_scope independent requires regulation_independence_rationale`,
    );
  }
  for (const regulationId of raw.linkage.regulations ?? []) {
    if (!regulationId.startsWith('regulation:')) {
      throw new Error(`linkage.regulations must use regulation: prefix: ${regulationId}`);
    }
  }
  for (const rewriteId of raw.linkage.rewrites ?? []) {
    if (!rewriteId.startsWith('rewrite:')) {
      throw new Error(`linkage.rewrites must use rewrite: prefix: ${rewriteId}`);
    }
  }
  return raw;
}

export function loadSkillCorpusEntry(filePath: string): SkillCorpusEntry {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as SkillCorpusEntry;
  return normalizeSkillCorpusEntry(raw);
}

function listSkillJsonFiles(skillsDir: string): string[] {
  if (!existsSync(skillsDir)) {
    return [];
  }
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(skillsDir, entry.name));
}

export function loadSkillCorpusEntries(customRoot?: string): SkillCorpusEntry[] {
  const root = resolveSkillCorpusRoot(customRoot);
  const skillsDir = join(root, 'skills');
  const entries: SkillCorpusEntry[] = [];

  for (const filePath of listSkillJsonFiles(skillsDir)) {
    entries.push(loadSkillCorpusEntry(filePath));
  }

  return entries.sort((a, b) => a.skill_id.localeCompare(b.skill_id));
}

export function loadSkillCorpus(customRoot?: string): SkillCorpusLoadResult {
  const root = resolveSkillCorpusRoot(customRoot);
  return {
    root,
    claim_types: loadSkillClaimTypes(root),
    entries: loadSkillCorpusEntries(root),
  };
}

export function isSkillCorpusType(corpusType: CorpusType): corpusType is 'skill' {
  return corpusType === 'skill';
}
