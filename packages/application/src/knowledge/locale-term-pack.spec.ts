import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LOCALE_RISK_TYPE_RULE_MAP,
  loadLocaleTermPack,
  mergeLocaleTermsIntoRules,
} from './locale-term-pack.js';
import { loadDemoRulePackSync, resetDemoRulePackCache } from './load-demo-rule-pack.js';
import { resolveDemoKnowledgePaths } from './demo-knowledge-paths.js';

/** CN mainland cluster terms that must live in demo/locales/cn.json, not APAC base lists. */
const CN_CLUSTER_TERMS_MUST_NOT_BE_IN_APAC_BASE = [
  '体检指标',
  '瘦了一圈',
  '身体轻盈',
  '睡眠质量明显提升',
  '精神好多了',
  '延长寿命',
  '血脂指标',
  '腰围小了',
  '口碑王',
  '轻盈起来',
  '气色红润',
  '吃得更踏实',
];

describe('locale-term-pack', () => {
  it('loads ID/VN/PH/CN locale packs from demo/locales', () => {
    const idPack = loadLocaleTermPack('ID');
    expect(idPack?.country_id).toBe('ID');
    expect(idPack?.terms.length).toBe(4);

    const vnPack = loadLocaleTermPack('VN');
    expect(vnPack?.terms.some((row) => row.risk_type === 'foreign-brand-ad-approval')).toBe(true);

    const phPack = loadLocaleTermPack('PH');
    expect(phPack?.terms.some((row) => row.risk_type === 'health-implication')).toBe(true);

    const cnPack = loadLocaleTermPack('CN');
    expect(cnPack?.country_id).toBe('CN');
    expect(cnPack?.terms.some((row) => row.risk_type === 'medical-claim')).toBe(true);
    expect(cnPack?.terms.some((row) => row.risk_type === 'health-implication')).toBe(true);
  });

  it('merges locale terms into mapped demo rules', () => {
    resetDemoRulePackCache();
    const pack = loadDemoRulePackSync();

    const idMarket = pack.rules.find((rule) => rule.rule_id === 'demo-id-sa-market-claim');
    expect(idMarket?.trigger_terms).toEqual(
      expect.arrayContaining(['terbaik', 'nomor satu', 'terpercaya']),
    );

    const vnAbsolute = pack.rules.find((rule) => rule.rule_id === 'demo-apac-sa-absolute-claim');
    const vnTerms = [...(vnAbsolute?.forbidden_terms ?? []), ...(vnAbsolute?.trigger_terms ?? [])];
    expect(vnTerms).toEqual(expect.arrayContaining(['tốt nhất', 'hoàn hảo']));
    expect(vnAbsolute?.scopes.countries).toContain('VN');

    const phHealth = pack.rules.find((rule) => rule.rule_id === 'demo-apac-sa-health-implication');
    expect(phHealth?.trigger_terms).toEqual(
      expect.arrayContaining(['malusog', 'para sa kalusugan']),
    );
    expect(phHealth?.scopes.countries).toContain('PH');

    const cnMedical = pack.rules.find((rule) => rule.rule_id === 'demo-apac-sa-health-claim-blocker');
    expect(cnMedical?.forbidden_terms).toEqual(
      expect.arrayContaining(['体检指标', '瘦了一圈', '血脂指标', '腰围小了']),
    );

    const cnImplication = pack.rules.find(
      (rule) => rule.rule_id === 'demo-apac-sa-health-implication',
    );
    expect(cnImplication?.trigger_terms).toEqual(
      expect.arrayContaining([
        '身体轻盈',
        '轻盈起来',
        '睡眠质量',
        '深度睡眠时间',
        '精神状态',
        '气色好多了',
        '气色红润',
        '吃得更健康',
        '吃得更踏实',
        '肠胃更舒服',
      ]),
    );

    const cnUnsourced = pack.rules.find((rule) => rule.rule_id === 'demo-cn-unsourced-metrics');
    expect(cnUnsourced?.trigger_terms).toEqual(
      expect.arrayContaining(['累计销量', '五星好评', '卖爆']),
    );

    const cnAbsolute = pack.rules.find((rule) => rule.rule_id === 'demo-cn-absolute-terms-blocker');
    expect(cnAbsolute?.forbidden_terms).toEqual(expect.arrayContaining(['口碑王']));
    expect(cnAbsolute?.trigger_patterns).toEqual(
      expect.arrayContaining(['(全网|全国|行业).{0,6}口碑王']),
    );
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

  it('mix-table guard: CN cluster terms stay out of demo-apac-sa-* base JSON', () => {
    const raw = JSON.parse(readFileSync(resolveDemoKnowledgePaths().rulesJson, 'utf8')) as {
      rules: Array<{
        rule_id: string;
        forbidden_terms?: string[];
        trigger_terms?: string[];
      }>;
    };

    for (const rule of raw.rules) {
      if (!rule.rule_id.startsWith('demo-apac-sa-')) continue;
      const bag = new Set([...(rule.forbidden_terms ?? []), ...(rule.trigger_terms ?? [])]);
      for (const term of CN_CLUSTER_TERMS_MUST_NOT_BE_IN_APAC_BASE) {
        expect(bag.has(term), `${term} must not be in base ${rule.rule_id}`).toBe(false);
      }
    }

    const cnPack = loadLocaleTermPack('CN');
    const cnBagBag = new Set(cnPack!.terms.flatMap((row) => row.terms));
    for (const term of CN_CLUSTER_TERMS_MUST_NOT_BE_IN_APAC_BASE) {
      expect(cnBagBag.has(term), `${term} must be in cn.json`).toBe(true);
    }
  });
});
