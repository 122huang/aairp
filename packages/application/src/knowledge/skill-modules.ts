import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FreshnessStatus, OwnerType } from './ownership.js';
import { buildPatternRuleLinks } from './rule-playbook-term-sync.js';

export type SkillModulePattern = {
  pattern_id: string;
  purpose: string;
  default_expected_severity: string;
  suggested_rewrite: string;
  rewrite_template_id?: string;
};

export type ActivationConditions = {
  countries: string[];
  categories: string[];
  modalities: string[];
};

export type RewriteStrategy = {
  default: 'qualify' | 'remove' | 'disclose' | 'cite_evidence';
  pattern_overrides?: Record<string, { type: string; template_id?: string }>;
};

export type EscalationPolicy = {
  blocker_rule_present: string;
  unverified_high_severity: string;
  default: string;
};

export type SkillModuleContract = {
  skill_module: string;
  description: string;
  owner: string;
  owner_type: OwnerType;
  last_reviewed_at: string;
  freshness_status: FreshnessStatus;
  activation_conditions: ActivationConditions;
  applicable_rules: string[];
  benchmark_scope: { skill_module: string };
  rewrite_strategy: RewriteStrategy;
  escalation_policy: EscalationPolicy;
  patterns: SkillModulePattern[];
};

export type GoldenIssueMapping = {
  skill_module: string;
  pattern_id: string | null;
  expected_rule: string | null;
  mapping_note?: string;
};

export type SkillModulesDocument = {
  schema_version: string;
  modules_version: string;
  description: string;
  playbook_source: string;
  playbook_id: string;
  modules: SkillModuleContract[];
  /** Canonical playbook pattern → executable rule mapping for term-sync validation. */
  pattern_rule_links?: Record<string, string[]>;
  golden_issue_map: Record<string, GoldenIssueMapping>;
};

/** @deprecated Use SkillModulesDocument — taxonomy is a read alias */
export type SkillTaxonomy = SkillModulesDocument & {
  taxonomy_version: string;
};

const defaultModulesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/knowledge/skill-modules.json',
);

export function resolveSkillModulesPath(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  if (process.env.AAIRP_SKILL_MODULES_PATH) {
    return process.env.AAIRP_SKILL_MODULES_PATH;
  }
  if (process.env.AAIRP_SKILL_TAXONOMY_PATH) {
    return process.env.AAIRP_SKILL_TAXONOMY_PATH;
  }
  return defaultModulesPath;
}

export function loadSkillModules(customPath?: string): SkillModulesDocument {
  const path = resolveSkillModulesPath(customPath);
  return JSON.parse(readFileSync(path, 'utf8')) as SkillModulesDocument;
}

/** Backward-compatible loader — maps modules_version to taxonomy_version */
export function loadSkillTaxonomy(customPath?: string): SkillTaxonomy {
  const doc = loadSkillModules(customPath);
  return {
    ...doc,
    taxonomy_version: doc.modules_version,
  };
}

export function listModulePatternIds(doc: SkillModulesDocument): string[] {
  return doc.modules.flatMap((module) => module.patterns.map((p) => p.pattern_id));
}

/** @deprecated Use listModulePatternIds */
export const listTaxonomyPatternIds = listModulePatternIds;

export function patternIdToModule(doc: SkillModulesDocument): Map<string, string> {
  const map = new Map<string, string>();
  for (const module of doc.modules) {
    for (const pattern of module.patterns) {
      map.set(pattern.pattern_id, module.skill_module);
    }
  }
  return map;
}

export function getModuleContract(
  doc: SkillModulesDocument,
  skillModule: string,
): SkillModuleContract | undefined {
  return doc.modules.find((m) => m.skill_module === skillModule);
}

export function getPatternMetadata(
  doc: SkillModulesDocument,
  patternId: string,
): SkillModulePattern | undefined {
  for (const module of doc.modules) {
    const found = module.patterns.find((p) => p.pattern_id === patternId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export function mapGoldenIssue(
  doc: SkillModulesDocument,
  issue: string,
): GoldenIssueMapping | undefined {
  return doc.golden_issue_map[issue];
}

export function resolvePatternRuleLinks(
  doc: SkillModulesDocument,
  playbookPatternIds: string[],
  benchmarkLinks: Array<{ pattern_id: string | null; expected_rule: string | null }>,
): Map<string, string[]> {
  const goldenLinks = Object.values(doc.golden_issue_map);
  return buildPatternRuleLinks(
    playbookPatternIds,
    doc.pattern_rule_links ?? {},
    goldenLinks,
    benchmarkLinks,
  );
}

export function deriveExpectedAction(
  expectedDecision: string,
  module?: SkillModuleContract,
): string {
  if (expectedDecision === 'PASS') {
    return 'PASS';
  }
  if (expectedDecision === 'REJECT') {
    return 'REJECT';
  }
  if (expectedDecision === 'REVIEW') {
    return module?.escalation_policy.unverified_high_severity === 'REVIEW'
      ? 'ESCALATE'
      : 'REVIEW';
  }
  return 'REWRITE';
}
