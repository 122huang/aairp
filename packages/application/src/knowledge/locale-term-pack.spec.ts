import { describe, expect, it } from 'vitest';
import {
  LOCALE_RISK_TYPE_RULE_MAP,
  loadLocaleTermPack,
  mergeLocaleTermsIntoRules,
} from './locale-term-pack.js';
import { loadDemoRulePackSync, resetDemoRulePackCache } from './load-demo-rule-pack.js';

describe('locale-term-pack', () => {
  it('loads ID/VN/PH locale packs from demo/locales', () => {
    const idPack = loadLocaleTermPack('ID');
    expect(idPack?.country_id).toBe('ID');
    expect(idPack?.terms.length).toBe(4);

    const vnPack = loadLocaleTermPack('VN');
    expect(vnPack?.terms.some((row) => row.risk_type === 'foreign-brand-ad-approval')).toBe(true);

    const phPack = loadLocaleTermPack('PH');
    expect(phPack?.terms.some((row) => row.risk_type === 'health-implication')).toBe(true);
  });

  it('merges locale trigger terms into mapped demo rules', () => {
    resetDemoRulePackCache();
    const pack = loadDemoRulePackSync();

    const idMarket = pack.rules.find((rule) => rule.rule_id === 'demo-id-sa-market-claim');
    expect(idMarket?.trigger_terms).toEqual(
      expect.arrayContaining(['terbaik', 'nomor satu', 'terpercaya']),
    );

    const vnAbsolute = pack.rules.find((rule) => rule.rule_id === 'demo-apac-sa-absolute-claim');
    expect(vnAbsolute?.trigger_terms).toEqual(
      expect.arrayContaining(['tốt nhất', 'hoàn hảo']),
    );
    expect(vnAbsolute?.scopes.countries).toContain('VN');

    const phHealth = pack.rules.find((rule) => rule.rule_id === 'demo-apac-sa-health-implication');
    expect(phHealth?.trigger_terms).toEqual(
      expect.arrayContaining(['malusog', 'para sa kalusugan']),
    );
    expect(phHealth?.scopes.countries).toContain('PH');
  });

  it('maps every locale risk_type to a rule id for each market', () => {
    for (const [countryId, mapping] of Object.entries(LOCALE_RISK_TYPE_RULE_MAP)) {
      const localePack = loadLocaleTermPack(countryId);
      expect(localePack).not.toBeNull();
      for (const row of localePack!.terms) {
        if (row.status === 'pending-rule') continue;
        expect(mapping[row.risk_type]).toBeTruthy();
      }
    }
  });

  it('merges disclosure terms into required_any_terms', () => {
    const merged = mergeLocaleTermsIntoRules(
      [
        {
          rule_id: 'demo-id-sponsored-disclosure',
          rule_version_id: 'v1',
          severity: 'LOW',
          decision: 'WARN',
          summary: 'test',
          scopes: { countries: ['ID'], categories: ['sa.other'] },
          required_any_terms: [],
        },
      ],
      [loadLocaleTermPack('ID')!],
    );
    expect(merged[0]?.required_any_terms).toEqual(
      expect.arrayContaining(['#iklan', 'berbayar', 'konten berbayar']),
    );
  });
});
