import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RuntimeRuleDefinition } from '@aairp/shared-kernel';
import { resolveDemoKnowledgePaths } from './demo-knowledge-paths.js';

export type LocaleTermPackRow = {
  risk_type: string;
  lang: string;
  terms: string[];
  source_regulation_id: string;
  note?: string;
  status?: 'pending-rule';
};

export type LocaleTermPack = {
  locale_pack_version: string;
  country_id: string;
  terms: LocaleTermPackRow[];
};

/** Maps locale pack risk_type → demo rule_id per market. */
export const LOCALE_RISK_TYPE_RULE_MAP: Record<string, Record<string, string>> = {
  ID: {
    'sponsored-disclosure': 'demo-id-sponsored-disclosure',
    'localisation-error': 'demo-apac-sa-localization',
    'product-category-boundary': 'demo-id-product-category-boundary',
    'market-ranking-claim': 'demo-id-sa-market-claim',
  },
  VN: {
    'absolute-claim-blocker': 'demo-apac-sa-absolute-claim',
    'market-ranking-claim': 'demo-vn-sa-market-claim',
    'localisation-error': 'demo-apac-sa-localization',
    'foreign-brand-ad-approval': 'demo-vn-foreign-brand-ad-approval',
  },
  PH: {
    'health-implication': 'demo-apac-sa-health-implication',
    'localisation-error': 'demo-apac-sa-localization',
    'sponsored-disclosure': 'demo-ph-sponsored-disclosure',
    'market-ranking-claim': 'demo-ph-sa-market-claim',
  },
};

const DISCLOSURE_RISK_TYPES = new Set(['sponsored-disclosure']);

export function loadLocaleTermPack(countryId: string, localesDir?: string): LocaleTermPack | null {
  const dir = localesDir ?? join(resolveDemoKnowledgePaths().rulesJson, '..', 'locales');
  const filePath = join(dir, `${countryId.toLowerCase()}.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, 'utf8')) as LocaleTermPack;
}

export function loadAllLocaleTermPacks(localesDir?: string): LocaleTermPack[] {
  return Object.keys(LOCALE_RISK_TYPE_RULE_MAP)
    .map((countryId) => loadLocaleTermPack(countryId, localesDir))
    .filter((pack): pack is LocaleTermPack => pack !== null);
}

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of terms) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(term);
  }
  return result;
}

export function mergeLocaleTermsIntoRules(
  rules: RuntimeRuleDefinition[],
  packs: LocaleTermPack[],
): RuntimeRuleDefinition[] {
  const byRuleId = new Map(rules.map((rule) => [rule.rule_id, { ...rule }]));

  for (const pack of packs) {
    const mapping = LOCALE_RISK_TYPE_RULE_MAP[pack.country_id];
    if (!mapping) continue;

    for (const row of pack.terms) {
      if (row.status === 'pending-rule' || row.terms.length === 0) continue;

      const ruleId = mapping[row.risk_type];
      if (!ruleId) continue;

      const rule = byRuleId.get(ruleId);
      if (!rule) continue;

      if (DISCLOSURE_RISK_TYPES.has(row.risk_type)) {
        rule.required_any_terms = uniqueTerms([...(rule.required_any_terms ?? []), ...row.terms]);
      } else {
        rule.trigger_terms = uniqueTerms([...(rule.trigger_terms ?? []), ...row.terms]);
      }
    }
  }

  return [...byRuleId.values()];
}

export const SEA_EXPANSION_COUNTRIES = ['ID', 'VN', 'PH'] as const;

export function expandApacSaRuleCountries(rules: RuntimeRuleDefinition[]): RuntimeRuleDefinition[] {
  return rules.map((rule) => {
    if (
      !rule.rule_id.startsWith('demo-apac-sa-') ||
      rule.rule_id === 'demo-apac-sa-localization-cjk'
    ) {
      return rule;
    }
    const countries = new Set([...rule.scopes.countries, ...SEA_EXPANSION_COUNTRIES]);
    return {
      ...rule,
      scopes: {
        ...rule.scopes,
        countries: [...countries].sort(),
      },
    };
  });
}
