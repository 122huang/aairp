import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeRuleDefinition, RuntimeRulePack } from '@aairp/shared-kernel';
import { resolveDemoKnowledgePaths, type DemoKnowledgePaths } from './demo-knowledge-paths.js';
import {
  expandApacSaRuleCountries,
  loadAllLocaleTermPacks,
  mergeLocaleTermsIntoRules,
} from './locale-term-pack.js';

type DemoRulesCountryOverride =
  | { decision?: string; severity?: string }
  | Record<string, { decision?: string; severity?: string }>;

type DemoRulesFileEntry = {
  rule_id: string;
  rule_version_id: string;
  severity: string;
  decision: string;
  summary: string;
  scopes: { countries: string[]; categories: string[] };
  forbidden_terms?: string[];
  trigger_terms?: string[];
  required_any_terms?: string[];
  activation_terms?: string[];
  required_any_mode?: 'always' | 'influencer_or_activation';
  when?: RuntimeRuleDefinition['when'];
  sku_mismatch_check?: boolean;
  citation?: { law_name: string; article?: string };
  country_decision_overrides?: Record<string, DemoRulesCountryOverride>;
};

type DemoRulesFile = {
  pack_version: string;
  rules: DemoRulesFileEntry[];
};

function normalizeRule(entry: DemoRulesFileEntry): RuntimeRuleDefinition {
  return {
    rule_id: entry.rule_id,
    rule_version_id: entry.rule_version_id,
    severity: entry.severity,
    decision: entry.decision,
    summary: entry.summary,
    scopes: entry.scopes,
    forbidden_terms: entry.forbidden_terms,
    trigger_terms: entry.trigger_terms,
    required_any_terms: entry.required_any_terms,
    activation_terms: entry.activation_terms,
    required_any_mode: entry.required_any_mode,
    when: entry.when,
    sku_mismatch_check: entry.sku_mismatch_check,
    citation: entry.citation
      ? { lawName: entry.citation.law_name, article: entry.citation.article }
      : undefined,
    country_decision_overrides: entry.country_decision_overrides,
  };
}

let cachedPack: RuntimeRulePack | undefined;
let cachedRulesPath: string | undefined;

/** Load demo/rules.demo.json synchronously (cached). Single source for offline eval + default RuleEngine. */
export function loadDemoRulePackSync(paths: DemoKnowledgePaths = resolveDemoKnowledgePaths()): RuntimeRulePack {
  if (cachedPack && cachedRulesPath === paths.rulesJson) {
    return cachedPack;
  }

  const raw = readFileSync(paths.rulesJson, 'utf8');
  const file = JSON.parse(raw) as DemoRulesFile;
  const baseRules = file.rules.map(normalizeRule);
  const localePacks = loadAllLocaleTermPacks(join(paths.rulesJson, '..', 'locales'));
  const mergedRules = mergeLocaleTermsIntoRules(baseRules, localePacks);
  cachedPack = {
    pack_version: file.pack_version,
    rules: expandApacSaRuleCountries(mergedRules),
  };
  cachedRulesPath = paths.rulesJson;
  return cachedPack;
}

/** Test helper — bust cache after editing rules.demo.json in-process. */
export function resetDemoRulePackCache(): void {
  cachedPack = undefined;
  cachedRulesPath = undefined;
}
