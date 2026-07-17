import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { loadDemoRulePackSync } from '../knowledge/load-demo-rule-pack.js';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { RuleEngineService } from './rule-engine.service.js';

const demoRulesAssetPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/rules.demo.json',
);

const INCIDENTAL_APPLIANCE_COMPLIANCE = new Set([
  'demo-sg-cpsr-registration-prerequisite',
  'demo-my-eeca-coe-prerequisite',
]);

function contentFindings(result: { findings: Array<{ refId: string }> }) {
  return result.findings.filter((f) => !INCIDENTAL_APPLIANCE_COMPLIANCE.has(f.refId));
}

const baseContext: ReviewContext = {
  reviewId: 'rev_test',
  advertisementId: 'ad_test',
  contentHash: 'hash123',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'META',
    categoryId: 'health.supplement',
  },
  normalizedContent: {
    text: 'Clinically proven to cure diabetes in 7 days. Buy now!',
    imageUrls: ['https://cdn.example.com/ad-banner.png'],
  },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: { adFormat: 'image' },
  tags: [],
  builtAt: '2026-06-26T10:05:00.000Z',
};

describe('RuleEngineService', () => {
  const fixedDate = new Date('2026-06-26T10:06:00.000Z');

  it('returns BLOCKER for forbidden health cure claims in text', () => {
    const service = new RuleEngineService({
      now: () => fixedDate,
      createFindingId: () => '11111111-1111-1111-1111-111111111111',
    });

    const result = service.evaluate(baseContext);

    expect(result.hasBlocker).toBe(true);
    expect(result.rulePackVersion).toBe(DEMO_KNOWLEDGE_VERSIONS.rulePackVersion);
    expect(result.evaluatedAt).toBe('2026-06-26T10:06:00.000Z');

    const blocker = result.findings.find(
      (finding) => finding.refId === 'demo-sg-health-forbidden-claim',
    );
    expect(blocker).toMatchObject({
      module: 'RULE',
      severity: 'BLOCKER',
      decision: 'FAIL',
      confidence: 1,
      evaluationDetail: {
        matchedSpans: [{ field: 'text', text: 'cure' }],
      },
    });
  });

  it('matches forbidden terms in ocr_text only', () => {
    const service = new RuleEngineService({
      createFindingId: () => '22222222-2222-2222-2222-222222222222',
    });

    const result = service.evaluate({
      ...baseContext,
      normalizedContent: {
        text: 'Shop supplements today',
        ocrText: 'Miracle cure inside every bottle',
        imageUrls: [],
      },
    });

    expect(result.hasBlocker).toBe(true);
    expect(result.findings.some((finding) => finding.refId === 'demo-sg-health-forbidden-claim')).toBe(
      true,
    );
  });

  it('does not use landingUrl for rule matching', () => {
    const service = new RuleEngineService();

    const result = service.evaluate({
      ...baseContext,
      normalizedContent: {
        text: 'Buy supplements today #ad',
        landingUrl: 'https://example.com/cure-now',
        imageUrls: [],
      },
    });

    expect(result.hasBlocker).toBe(false);
    expect(result.findings.some((finding) => finding.refId === 'demo-sg-health-forbidden-claim')).toBe(
      false,
    );
  });

  it('returns WARN findings for superlative claims but not brand-copy disclosure misses', () => {
    const service = new RuleEngineService();

    const result = service.evaluate(baseContext);

    expect(result.findings.some((finding) => finding.refId === 'demo-sg-health-superlative')).toBe(
      true,
    );
    // Brand / unlabeled copy without gifted/KOL activation signals must not trip disclosure.
    expect(
      result.findings.some((finding) => finding.refId === 'demo-sg-sponsored-disclosure'),
    ).toBe(false);
  });

  it('fires INFO reminder for INFLUENCER_UGC without requiring missing #ad', () => {
    const service = new RuleEngineService();
    const result = service.evaluate({
      ...baseContext,
      normalizedContent: {
        text: 'Daily vitamins for general wellness support.',
        imageUrls: [],
      },
      advertisementContext: { adType: 'INFLUENCER_UGC' },
    });
    const finding = result.findings.find((f) => f.refId === 'demo-sg-sponsored-disclosure');
    expect(finding).toBeDefined();
    expect(finding?.decision).toBe('INFO');
  });

  it('fires JP stealth-marketing INFO reminder with CAA enforcement copy for INFLUENCER_UGC', () => {
    const service = new RuleEngineService();
    const result = service.evaluate({
      ...baseContext,
      dimensions: {
        ...baseContext.dimensions,
        countryId: 'JP',
        categoryId: 'sa.air_fryer',
      },
      normalizedContent: {
        text: 'ブランド様よりいただいたエアフライヤーで毎日おいしく調理。',
        imageUrls: [],
      },
      advertisementContext: { adType: 'INFLUENCER_UGC' },
    });
    const finding = result.findings.find((f) => f.refId === 'demo-jp-stealth-marketing-disclosure');
    expect(finding).toBeDefined();
    expect(finding?.decision).toBe('INFO');
    expect(finding?.summary).toMatch(/Consumer Affairs Agency|ステマ|执法/);
  });

  it('still fires sponsored INFO reminder when #ad is already present', () => {
    const service = new RuleEngineService();
    const result = service.evaluate({
      ...baseContext,
      normalizedContent: {
        text: 'Daily vitamins for general wellness support. #ad',
        imageUrls: [],
      },
      advertisementContext: { adType: 'INFLUENCER_UGC' },
    });
    const finding = result.findings.find((f) => f.refId === 'demo-sg-sponsored-disclosure');
    expect(finding).toBeDefined();
    expect(finding?.decision).toBe('INFO');
  });

  it('fires sponsored INFO reminder via activation_terms when ad_type unset', () => {
    const service = new RuleEngineService();
    const result = service.evaluate({
      ...baseContext,
      normalizedContent: {
        text: '谢谢品牌送的这台产品，这几天真的爱不释手。',
        imageUrls: [],
      },
      advertisementContext: {},
    });
    const finding = result.findings.find((f) => f.refId === 'demo-sg-sponsored-disclosure');
    expect(finding).toBeDefined();
    expect(finding?.decision).toBe('INFO');
    expect(finding?.summary).toContain('网红/合作');
  });

  it('does not fire sponsored disclosure for BRAND_PRODUCT even without #ad', () => {
    const service = new RuleEngineService();
    const result = service.evaluate({
      ...baseContext,
      normalizedContent: {
        text: 'Daily vitamins for general wellness support.',
        imageUrls: [],
      },
      advertisementContext: { adType: 'BRAND_PRODUCT' },
    });
    expect(
      result.findings.some((finding) => finding.refId === 'demo-sg-sponsored-disclosure'),
    ).toBe(false);
  });

  it('localizes rule summary to Chinese for Chinese-primary ad copy', () => {
    const service = new RuleEngineService();
    const result = service.evaluate({
      ...baseContext,
      normalizedContent: {
        text: '每日维生素，支持日常健康与营养补充，适合全家使用。',
        imageUrls: [],
      },
      advertisementContext: { adType: 'INFLUENCER_UGC' },
    });
    const finding = result.findings.find((f) => f.refId === 'demo-sg-sponsored-disclosure');
    expect(finding?.summary).toContain('网红/合作');
  });

  it('returns no findings for out-of-scope dimensions', () => {
    const service = new RuleEngineService();

    const result = service.evaluate({
      ...baseContext,
      dimensions: {
        ...baseContext.dimensions,
        countryId: 'US',
      },
    });

    expect(result.findings).toEqual([]);
    expect(result.hasBlocker).toBe(false);
  });

  it('does not match cure as substring inside secure', () => {
    const service = new RuleEngineService();

    const result = service.evaluate({
      ...baseContext,
      normalizedContent: {
        text: 'Secure checkout for wellness supplements. #ad',
        imageUrls: [],
      },
    });

    expect(result.hasBlocker).toBe(false);
    expect(
      result.findings.some((finding) => finding.refId === 'demo-sg-health-forbidden-claim'),
    ).toBe(false);
  });

  it('returns no findings for clean compliant ad copy', () => {
    const service = new RuleEngineService();

    const result = service.evaluate({
      ...baseContext,
      normalizedContent: {
        text: 'Daily vitamins for general wellness. #ad',
        imageUrls: ['https://cdn.example.com/vitamins.png'],
      },
    });

    expect(result.findings).toEqual([]);
    expect(result.hasBlocker).toBe(false);
  });

  it('aligns runtime evaluation with demo/rules.demo.json reference asset', () => {
    const asset = JSON.parse(readFileSync(demoRulesAssetPath, 'utf8')) as {
      pack_version: string;
      rules: Array<{
        rule_id: string;
        rule_version_id: string;
        severity: string;
        decision: string;
        summary: string;
        forbidden_terms?: string[];
        trigger_terms?: string[];
        required_any_terms?: string[];
        scopes: { countries: string[]; categories: string[] };
      }>;
    };

    expect(asset.pack_version).toBe(DEMO_KNOWLEDGE_VERSIONS.rulePackVersion);
    expect(asset.rules).toHaveLength(74);

    const service = new RuleEngineService();
    const scopeContext: ReviewContext = {
      ...baseContext,
      dimensions: {
        ...baseContext.dimensions,
        countryId: asset.rules[0]!.scopes.countries[0]!,
        categoryId: asset.rules[0]!.scopes.categories[0]!,
      },
    };

    const forbiddenRule = asset.rules.find((rule) => rule.rule_id === 'demo-sg-health-forbidden-claim')!;
    const forbiddenResult = service.evaluate({
      ...scopeContext,
      normalizedContent: {
        text: `Product ${forbiddenRule.forbidden_terms![0]!} fast`,
        imageUrls: [],
      },
    });
    expect(forbiddenResult.findings).toContainEqual(
      expect.objectContaining({
        refId: forbiddenRule.rule_id,
        refVersionId: forbiddenRule.rule_version_id,
        severity: forbiddenRule.severity,
        decision: forbiddenRule.decision,
        summary: forbiddenRule.summary,
      }),
    );

    const superlativeRule = asset.rules.find((rule) => rule.rule_id === 'demo-sg-health-superlative')!;
    const superlativeResult = service.evaluate({
      ...scopeContext,
      normalizedContent: {
        text: `Offer is ${superlativeRule.trigger_terms![0]!}`,
        imageUrls: [],
      },
    });
    expect(superlativeResult.findings).toContainEqual(
      expect.objectContaining({
        refId: superlativeRule.rule_id,
        refVersionId: superlativeRule.rule_version_id,
        severity: superlativeRule.severity,
        decision: superlativeRule.decision,
        summary: superlativeRule.summary,
      }),
    );

    const disclosureRule = asset.rules.find(
      (rule) => rule.rule_id === 'demo-sg-sponsored-disclosure',
    )!;
    const missingDisclosureResult = service.evaluate({
      ...scopeContext,
      normalizedContent: { text: 'Buy wellness supplements today', imageUrls: [] },
      advertisementContext: { adType: 'INFLUENCER_UGC' },
    });
    expect(missingDisclosureResult.findings).toContainEqual(
      expect.objectContaining({
        refId: disclosureRule.rule_id,
        refVersionId: disclosureRule.rule_version_id,
        severity: disclosureRule.severity,
        decision: disclosureRule.decision,
        summary: disclosureRule.summary,
      }),
    );

    // INFO reminder still fires when disclosure keywords are already present in copy.
    const disclosedResult = service.evaluate({
      ...scopeContext,
      normalizedContent: {
        text: 'Buy wellness supplements today #ad',
        imageUrls: [],
      },
      advertisementContext: { adType: 'INFLUENCER_UGC' },
    });
    expect(
      disclosedResult.findings.some((finding) => finding.refId === disclosureRule.rule_id),
    ).toBe(true);
    expect(
      disclosedResult.findings.find((finding) => finding.refId === disclosureRule.rule_id)?.decision,
    ).toBe('INFO');
  });

  it('evaluates injected rulePack identically to default demo JSON path', () => {
    const pack = loadDemoRulePackSync();

    const defaultPath = new RuleEngineService().evaluate(baseContext);
    const fromPack = new RuleEngineService({ rulePack: pack }).evaluate(baseContext);

    expect(fromPack.hasBlocker).toBe(defaultPath.hasBlocker);
    expect(fromPack.findings.map((f) => f.refId).sort()).toEqual(
      defaultPath.findings.map((f) => f.refId).sort(),
    );
  });

  describe('APAC small appliance rules (SG/MY/TH)', () => {
    const saContext = (countryId: string, text: string): ReviewContext => ({
      ...baseContext,
      dimensions: {
        ...baseContext.dimensions,
        countryId,
        categoryId: 'sa.rice_cooker',
      },
      normalizedContent: { text, imageUrls: [] },
    });

    it('REJECT on every time absolute claim (rice cooker ad)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext(
          'SG',
          'Delivers plump, soft and evenly cooked rice every time',
        ),
      );

      expect(result.hasBlocker).toBe(true);
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim')).toBe(true);
    });

    it('REJECT on perfect + every time (Pilot P-001)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('SG', 'Easy presents for perfect results every time'),
      );

      expect(result.hasBlocker).toBe(true);
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim')).toBe(true);
    });

    it('REJECT on superlative best machine ever + world no.1', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('SG', 'the best machine ever, world no.1'),
      );

      expect(result.hasBlocker).toBe(true);
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim')).toBe(true);
    });

    it('REJECT on the best without contiguous best ever phrase', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('SG', 'the best machine ever'));

      expect(result.hasBlocker).toBe(true);
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim')).toBe(true);
    });

    it('REJECT on world no.1 ranking claim', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('SG', 'world no.1'));

      expect(result.hasBlocker).toBe(true);
      const absoluteFinding = result.findings.find(
        (f) => f.refId === 'demo-apac-sa-absolute-claim',
      );
      expect(absoluteFinding).toBeDefined();
      expect(absoluteFinding?.severity).toBe('BLOCKER');
    });

    it('PASS on lifestyle convenience copy without superiority claims', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('SG', 'Spend less time cleaning and more time living'),
      );

      expect(result.hasBlocker).toBe(false);
      // CPSR/COE may still fire for appliance categories; content claim layer must be clean.
      expect(contentFindings(result)).toHaveLength(0);
    });

    it('WARN on better rice comparative implication (batch #10)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('SG', 'Enjoy better rice with every serving'),
      );

      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-comparative-claim')).toBe(
        true,
      );
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim-soft')).toBe(
        true,
      );
    });

    it('WARN on never look back omnibus experience (batch #11)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('SG', 'Vacuum performance you will never look back from'),
      );

      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim-soft')).toBe(
        true,
      );
    });

    it('WARN on restaurant-quality without evidence (batch #12)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('SG', 'Restaurant-quality rice with every use'),
      );

      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-certification-evidence')).toBe(
        true,
      );
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim-soft')).toBe(
        true,
      );
    });

    it('REJECT on foolproof + every single time (batch #13)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('SG', 'Foolproof rice cooking every single time'),
      );

      expect(result.hasBlocker).toBe(true);
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim')).toBe(true);
    });

    it.each([
      ['V1', 'sa.vacuum_floor', '清洁力经得起每一次家庭考验。', 'demo-apac-sa-absolute-claim-soft'],
      ['V2', 'sa.vacuum_floor', '让看不见的灰尘也无处停留。', null],
      ['V3', 'sa.vacuum_floor', 'A cleaner home starts with every single pass.', null],
      ['V4', 'sa.vacuum_floor', 'Designed to capture what ordinary cleaning may leave behind.', null],
      ['B1', 'sa.blender_processor', 'Brings out the natural goodness in every blend.', 'demo-apac-sa-health-implication'],
      ['B2', 'sa.blender_processor', 'Smooth results that make healthy choices easier.', 'demo-apac-sa-health-implication'],
    ])('user batch %s (%s)', (_id, categoryId, text, ruleId) => {
      const service = new RuleEngineService();
      const result = service.evaluate({
        ...baseContext,
        dimensions: { ...baseContext.dimensions, countryId: 'SG', categoryId },
        normalizedContent: { text, imageUrls: [] },
      });

      if (ruleId) {
        expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
      } else {
        expect(result.hasBlocker).toBe(false);
        expect(contentFindings(result)).toHaveLength(0);
      }
    });

    it('WARN on cleaner than comparative phrasing', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('SG', 'Delivers a cleaner than ordinary mop experience'),
      );

      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-comparative-claim')).toBe(
        true,
      );
    });

    describe('SG 20-line batch (lifestyle vs claims)', () => {
      const sgCase = (categoryId: string, text: string) => ({
        ...baseContext,
        dimensions: { ...baseContext.dimensions, countryId: 'SG', categoryId },
        normalizedContent: { text, imageUrls: [] },
      });

      it.each([
        ['A1', 'sa.rice_cooker', '内置控温程序，轻松还原米饭自然香气。'],
        ['A2', 'sa.vacuum_floor', '多层过滤设计，全面清洁地板与地毯表面。'],
        ['A3', 'sa.blender_processor', '五档调速，轻松应对不同食材需求。'],
        ['A4', 'sa.air_fryer', '360°热风循环，无需预热，即放即炸。'],
        ['A5', 'sa.blender_processor', '大容量设计，满足全家日常备餐所需。'],
        ['B1', 'sa.vacuum_floor', 'Multi-layer filtration captures dust, pet hair and fine particles.'],
        ['B2', 'sa.rice_cooker', 'Twelve cooking modes for jasmine rice, brown rice and porridge.'],
        ['B3', 'sa.air_fryer', 'Rapid hot-air circulation for a crispy finish with minimal oil.'],
        ['B4', 'sa.blender_processor', '1,000W motor handles ice, nuts and fibrous greens with ease.'],
        ['B5', 'sa.air_fryer', 'Four-litre capacity — designed for Singapore family meal prep.'],
        ['C3', 'sa.rice_cooker', '模拟柴火慢煮，还原传统米香与口感。'],
      ])('lifestyle %s stays PASS', (_id, categoryId, text) => {
        const service = new RuleEngineService();
        const result = service.evaluate(sgCase(categoryId, text));

        expect(result.hasBlocker).toBe(false);
        expect(contentFindings(result)).toHaveLength(0);
      });

      it.each([
        [
          'C1',
          'sa.air_fryer',
          '比传统油炸减少高达80%的用油量，让美食更轻盈。',
          ['demo-apac-sa-comparative-claim', 'demo-apac-sa-performance-claim'],
        ],
        [
          'C2',
          'sa.vacuum_floor',
          '深层清除床垫螨虫，有效减少室内过敏源。',
          ['demo-apac-sa-health-implication'],
        ],
        [
          'C4',
          'sa.blender_processor',
          '冷萃技术，最大程度保留果蔬天然营养成分。',
          ['demo-apac-sa-health-implication'],
        ],
        [
          'C5',
          'sa.air_fryer',
          '少油烹饪，让全家饮食更加轻松无负担。',
          ['demo-apac-sa-health-implication'],
        ],
        [
          'D1',
          'sa.rice_cooker',
          'Slow-cook mode delivers the texture of traditional clay-pot cooking.',
          [],
        ],
        [
          'D2',
          'sa.blender_processor',
          'Cold-blend technology designed to preserve more of the natural goodness in your fruits and vegetables.',
          ['demo-apac-sa-health-implication'],
        ],
        [
          'D3',
          'sa.vacuum_floor',
          'Removes up to 99% of household dust — tested under standard lab conditions.',
          ['demo-apac-sa-performance-claim', 'demo-apac-sa-certification-evidence'],
        ],
        [
          'D4',
          'sa.air_fryer',
          'Up to 80% less oil compared to conventional deep frying.',
          ['demo-apac-sa-performance-claim', 'demo-apac-sa-comparative-claim'],
        ],
        [
          'D5',
          'sa.blender_processor',
          'Engineered to support your daily nutrition routine.',
          ['demo-apac-sa-health-implication'],
        ],
      ])('claims %s triggers expected rules', (_id, categoryId, text, ruleIds) => {
        const service = new RuleEngineService();
        const result = service.evaluate(sgCase(categoryId, text));

        for (const ruleId of ruleIds) {
          expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
        }
      });
    });

    describe('SG 30-line batch (user verification alignment)', () => {
      const sgCase = (categoryId: string, text: string) => ({
        ...baseContext,
        dimensions: { ...baseContext.dimensions, countryId: 'SG', categoryId },
        normalizedContent: { text, imageUrls: [] },
      });

      it.each([
        [
          'C1',
          'sa.blender_processor',
          '每日一杯，促进肠胃消化，全面提升免疫力。',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
        [
          'C2',
          'sa.rice_cooker',
          '新加坡销量第一电饭煲，品质无可超越。',
          false,
          ['demo-apac-sa-comparative-claim', 'demo-sg-sa-market-claim'],
        ],
        [
          'C3',
          'sa.air_fryer',
          '零油烹饪，彻底告别心血管疾病威胁，守护全家健康。',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
        [
          'C4',
          'sa.vacuum_floor',
          '99.9%杀菌除螨，经临床验证，保护家人肺部健康。',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
        [
          'C5',
          'sa.rice_cooker',
          '晚上放入鸡肉食材，早上起床即享热腾腾的鸡肉粥。',
          true,
          ['demo-apac-sa-food-safety-blocker'],
        ],
        [
          'C8',
          'sa.air_fryer',
          'Zero oil. Zero cholesterol risk. Endorsed by Singapore cardiologists.',
          true,
          ['demo-apac-sa-health-claim-blocker', 'demo-sg-sa-market-claim'],
        ],
        [
          'C9',
          'sa.rice_cooker',
          "Singapore's #1 rice cooker — nothing else comes close.",
          false,
          ['demo-apac-sa-comparative-claim', 'demo-sg-sa-market-claim'],
        ],
        [
          'C10',
          'sa.rice_cooker',
          'Load raw chicken before bed, wake up to a perfectly cooked meal tomorrow morning.',
          true,
          ['demo-apac-sa-food-safety-blocker'],
        ],
      ])('high-risk %s', (_id, categoryId, text, expectBlocker, ruleIds) => {
        const service = new RuleEngineService();
        const result = service.evaluate(sgCase(categoryId, text));

        expect(result.hasBlocker).toBe(expectBlocker);
        for (const ruleId of ruleIds) {
          expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
        }
      });
    });

    describe('MY 30-line batch (user verification alignment)', () => {
      const myCase = (categoryId: string, text: string) => ({
        ...baseContext,
        dimensions: { ...baseContext.dimensions, countryId: 'MY', categoryId },
        normalizedContent: { text, imageUrls: [] },
      });

      it('B9 flags 75% oil reduction for substantiation', () => {
        const service = new RuleEngineService();
        const result = service.evaluate(
          myCase(
            'sa.air_fryer',
            'Cuts oil use by up to 75% compared to traditional deep-frying methods.',
          ),
        );

        expect(result.hasBlocker).toBe(false);
        expect(result.findings.some((f) => f.refId === 'demo-apac-sa-performance-claim')).toBe(
          true,
        );
      });

      it.each([
        [
          'A8',
          'sa.blender_processor',
          'BPA-free jug with tool-free blade removal for quick and easy cleaning.',
          ['demo-apac-sa-material-safety-claim'],
        ],
        [
          'B7',
          'sa.blender_processor',
          'Designed to help retain the natural enzymes in fresh tropical produce.',
          ['demo-apac-sa-health-implication'],
        ],
        [
          'B8',
          'sa.vacuum_floor',
          'HEPA-class filtration captures fine particulates for improved indoor air quality.',
          ['demo-apac-sa-certification-evidence', 'demo-apac-sa-health-implication'],
        ],
      ])('lifestyle/claims %s flags expected rules', (_id, categoryId, text, ruleIds) => {
        const service = new RuleEngineService();
        const result = service.evaluate(myCase(categoryId, text));

        expect(result.hasBlocker).toBe(false);
        for (const ruleId of ruleIds) {
          expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
        }
      });

      it.each([
        [
          'C1',
          'sa.blender_processor',
          '每日一杯活性酵素饮，排毒净体，由内而外焕发光彩。',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
        [
          'C2',
          'sa.air_fryer',
          '马来西亚销量冠军，永远是最好的选择。',
          true,
          ['demo-apac-sa-absolute-claim', 'demo-my-sa-market-claim'],
        ],
        [
          'C3',
          'sa.vacuum_floor',
          '经权威机构临床认证，除螨率100%，全面净化居家空气。',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
        [
          'C4',
          'sa.rice_cooker',
          '晚上放入牛腩食材，隔夜慢炖，清晨开盖即享软烂肉饭。',
          true,
          ['demo-apac-sa-food-safety-blocker'],
        ],
        [
          'C5',
          'sa.blender_processor',
          '低GI饮食必备，助力控糖，适合糖尿病患者日常使用。',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
        [
          'C6',
          'sa.vacuum_floor',
          "Malaysia's #1 trusted vacuum brand — certified by national health authorities.",
          false,
          ['demo-apac-sa-comparative-claim', 'demo-my-sa-market-claim'],
        ],
        [
          'C7',
          'sa.air_fryer',
          'Eat fried food without the health consequences — oil-free cooking eliminates all health risks.',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
        [
          'C8',
          'sa.rice_cooker',
          'Prep raw fish and marinated chicken before bed — wake up to a fresh Malaysian breakfast.',
          true,
          ['demo-apac-sa-food-safety-blocker'],
        ],
        [
          'C9',
          'sa.blender_processor',
          'Doctor-recommended for patients managing diabetes and high cholesterol.',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
        [
          'C10',
          'sa.vacuum_floor',
          'Kills 100% of dust mites — pharmaceutical-grade sterilisation at home.',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
      ])('high-risk %s', (_id, categoryId, text, expectBlocker, ruleIds) => {
        const service = new RuleEngineService();
        const result = service.evaluate(myCase(categoryId, text));

        expect(result.hasBlocker).toBe(expectBlocker);
        for (const ruleId of ruleIds) {
          expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
        }
      });
    });

    describe('TH 30-line batch (user verification alignment)', () => {
      const thCase = (categoryId: string, text: string) => ({
        ...baseContext,
        dimensions: { ...baseContext.dimensions, countryId: 'TH', categoryId },
        normalizedContent: { text, imageUrls: [] },
      });

      it.each([
        [
          'A9',
          'sa.air_fryer',
          "มอก.-certified for safe operation on Thailand's 220V electrical standard.",
          ['demo-apac-sa-certification-evidence'],
        ],
        [
          'B1',
          'sa.vacuum_floor',
          '高效过滤微细尘粒，有助改善室内空气品质。',
          ['demo-apac-sa-health-implication'],
        ],
        [
          'B2',
          'sa.rice_cooker',
          '与同类产品相比节能高达30%，减少家庭电费支出。',
          ['demo-apac-sa-performance-claim'],
        ],
        [
          'B4',
          'sa.air_fryer',
          '与传统油炸方式相比，减少高达70%的食用油用量。',
          ['demo-apac-sa-performance-claim'],
        ],
        [
          'B6',
          'sa.air_fryer',
          'Uses up to 70% less oil than traditional frying — same crispy results, lighter on the stomach.',
          ['demo-apac-sa-performance-claim'],
        ],
        [
          'B7',
          'sa.blender_processor',
          'Cold-blend function designed to minimise heat damage to natural vitamins.',
          ['demo-apac-sa-health-implication'],
        ],
        [
          'B8',
          'sa.rice_cooker',
          'Sensor-adjusted cooking reduces energy use by up to 25% vs. conventional models.',
          ['demo-apac-sa-performance-claim'],
        ],
        [
          'B9',
          'sa.vacuum_floor',
          'Multi-layer filtration captures fine dust particles to support cleaner indoor air.',
          ['demo-apac-sa-health-implication'],
        ],
      ])('claims %s flags expected rules', (_id, categoryId, text, ruleIds) => {
        const service = new RuleEngineService();
        const result = service.evaluate(thCase(categoryId, text));

        expect(result.hasBlocker).toBe(false);
        for (const ruleId of ruleIds) {
          expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
        }
      });

      it.each([
        [
          'C1',
          'sa.blender_processor',
          '泰国销量排名第一，品质经权威机构认证，无出其右。',
          false,
          ['demo-apac-sa-comparative-claim', 'demo-apac-sa-certification-evidence', 'demo-th-sa-market-claim'],
        ],
        [
          'C3',
          'sa.vacuum_floor',
          '灭螨率100%，经泰国卫生部临床认证，呵护过敏人群。',
          true,
          ['demo-apac-sa-health-claim-blocker', 'demo-th-sa-market-claim'],
        ],
        [
          'C6',
          'sa.vacuum_floor',
          "Clinically proven by Thailand's Ministry of Public Health — eliminates all allergy-causing dust mites.",
          true,
          ['demo-apac-sa-health-claim-blocker', 'demo-th-sa-market-claim'],
        ],
        [
          'C8',
          'sa.air_fryer',
          'Load raw pork and marinated fish before bed — wake up to a fully cooked Thai-style breakfast.',
          true,
          ['demo-apac-sa-food-safety-blocker'],
        ],
        [
          'C9',
          'sa.blender_processor',
          'Detox juice that cleanses your liver and boosts immunity — rooted in traditional Thai herbal medicine.',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
        [
          'C10',
          'sa.air_fryer',
          'Zero oil, zero fat, zero cholesterol — medically endorsed for heart disease and diabetes management.',
          true,
          ['demo-apac-sa-health-claim-blocker'],
        ],
      ])('high-risk %s', (_id, categoryId, text, expectBlocker, ruleIds) => {
        const service = new RuleEngineService();
        const result = service.evaluate(thCase(categoryId, text));

        expect(result.hasBlocker).toBe(expectBlocker);
        for (const ruleId of ruleIds) {
          expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
        }
      });
    });

    it('WARN on zero-fault absolute reliability wording (零故障)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('SG', '零故障的设计'),
      );

      expect(result.hasBlocker).toBe(false);
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim-soft')).toBe(
        true,
      );
    });

    describe('health implication (WARN) vs medical claim (REJECT)', () => {
      it.each([
        ['少油烹饪，吃得更轻盈', 'demo-apac-sa-health-implication'],
        ['保留果蔬天然营养成分', 'demo-apac-sa-health-implication'],
        ['冷萃设计，减少营养流失', 'demo-apac-sa-health-implication'],
        ['natural enzymes preserved in every blend', 'demo-apac-sa-health-implication'],
        ['wholesome meals for the whole family', 'demo-apac-sa-health-implication'],
        ['goodness locked in every blend', 'demo-apac-sa-health-implication'],
        ['lighter cooking, lighter living', 'demo-apac-sa-health-implication'],
        ['无负担的美食体验', 'demo-apac-sa-health-implication'],
        ['无负担', 'demo-apac-sa-health-implication'],
        ['轻盈无负担', 'demo-apac-sa-health-implication'],
        ['每天吃得更清爽', 'demo-apac-sa-health-implication'],
      ])('health implication: %s', (text, ruleId) => {
        const service = new RuleEngineService();
        const result = service.evaluate(saContext('SG', text));

        expect(result.hasBlocker).toBe(false);
        expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
      });

      it.each([
        ['促进肠胃消化，提升免疫力', 'demo-apac-sa-health-claim-blocker'],
        ['降低心血管疾病风险', 'demo-apac-sa-health-claim-blocker'],
        ['适合糖尿病患者控糖', 'demo-apac-sa-health-claim-blocker'],
        ['经临床验证，保护肺部健康', 'demo-apac-sa-health-claim-blocker'],
        ['排毒净体，改善体内环境', 'demo-apac-sa-health-claim-blocker'],
        ['doctor-recommended for high cholesterol', 'demo-apac-sa-health-claim-blocker'],
        ['clinically proven to improve nutrient absorption', 'demo-apac-sa-health-claim-blocker'],
        ['helps manage blood sugar levels', 'demo-apac-sa-health-claim-blocker'],
        ['reduces allergy symptoms in sensitive users', 'demo-apac-sa-health-claim-blocker'],
        ['pharmaceutical-grade sterilisation at home', 'demo-apac-sa-health-claim-blocker'],
      ])('medical claim: %s', (text, ruleId) => {
        const service = new RuleEngineService();
        const result = service.evaluate(saContext('SG', text));

        expect(result.hasBlocker).toBe(true);
        expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
      });
    });

    it('WARN on health implication (Pilot P-002)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('MY', 'Lower Sugar Healthier Every Bowl'),
      );

      expect(result.hasBlocker).toBe(true);
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-health-claim-blocker')).toBe(
        true,
      );
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-health-implication')).toBe(
        true,
      );
    });

    it('WARN on comparative without baseline (Pilot P-003)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('TH', 'Less wear, less noise and more efficient power'),
      );

      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-comparative-claim')).toBe(
        true,
      );
    });

    it('applies to legacy electronics category for pilot cases', () => {
      const service = new RuleEngineService();
      const result = service.evaluate({
        ...baseContext,
        dimensions: { ...baseContext.dimensions, categoryId: 'electronics' },
        normalizedContent: {
          text: 'Delivers plump, soft and evenly cooked rice every time',
          imageUrls: [],
        },
      });

      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim')).toBe(true);
    });

    it.each([
      ['PC-008', 'Lower Sugar Healthier Every Bowl'],
      ['BL-007', 'Easy to digest'],
      ['BL-008', 'Better nutrient absorption'],
      ['BL-009', 'Sterilize'],
      ['RC18-008', 'Low-sugar rice'],
      ['RC40-001', 'Medical-grade 316L stainless steel'],
      ['P655-001', '99.9999% bacteria removal'],
      ['V9-001', 'Fat-reducing'],
      ['V9-002', 'Less fat'],
    ])('BLOCKER on Golden critical health/medical %s', (_caseId, text) => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('SG', text));

      expect(result.hasBlocker).toBe(true);
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-health-claim-blocker')).toBe(
        true,
      );
    });

    it.each([
      ['AF-002', 'Easy presents for perfect results every time', 'demo-apac-sa-absolute-claim'],
      ['AF-003', 'Goes beyond standard air fryer (200℃)', 'demo-apac-sa-comparative-claim'],
      ['AF-004', 'Non-stick', 'demo-apac-sa-performance-claim'],
      ['AF-009', 'Authoritative certification meets national standard grade', 'demo-apac-sa-certification-evidence'],
      ['PC-004', 'Tender beef stew in 30 minutes', 'demo-apac-sa-performance-claim'],
      ['PC-005', '70kPa', 'demo-apac-sa-performance-claim'],
      ['PC-007', 'Non-stick', 'demo-apac-sa-performance-claim'],
      ['PC-009', 'Copper Pot vs Stainless Steel inconsistency', 'demo-apac-sa-content-consistency-blocker'],
      ['PC-016', 'Stainless Steel / Copper / Ceramic inconsistency', 'demo-apac-sa-content-consistency-blocker'],
      ['BL-002', 'Enhanced noise reduction', 'demo-apac-sa-performance-claim'],
      ['RC18-001', 'Non-stick', 'demo-apac-sa-performance-claim'],
      ['RC18-009', '304/316 stainless steel claimed as Non-stick', 'demo-apac-sa-performance-claim'],
      ['RC40-005', 'Every time', 'demo-apac-sa-absolute-claim'],
      ['LZ9-002', '+15% juice yield', 'demo-apac-sa-performance-claim'],
      ['LZ9-003', '+12% purer juice', 'demo-apac-sa-performance-claim'],
      ['LZ9-007', 'IF Award model verification', 'demo-apac-sa-certification-evidence'],
      ['LZ585-003', 'Patented', 'demo-apac-sa-certification-evidence'],
      ['P655-002', 'National standard grade', 'demo-apac-sa-certification-evidence'],
      ['V9-003', 'Up to 68% less oil', 'demo-apac-sa-performance-claim'],
      ['GEN-001', 'Third-party laboratory report', 'demo-apac-sa-certification-evidence'],
      ['GEN-003', 'Internal laboratory data', 'demo-apac-sa-certification-evidence'],
      ['GEN-007', '16-Hour Freshness Mode', 'demo-apac-sa-performance-claim'],
    ])('detects Golden High risk %s', (_caseId, text, ruleId) => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('SG', text));

      expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
    });

    it.each([
      ['AF-006', 'Comparison with higher-end Joyoung model', 'demo-apac-sa-comparative-claim'],
      ['PC-002', 'Large Capacity', 'demo-apac-sa-comparative-claim'],
      ['PC-003', 'Cook Faster', 'demo-apac-sa-comparative-claim'],
      ['PC-006', 'Stew up to 2kg beef', 'demo-apac-sa-capacity-claim'],
      [
        'PC-006b',
        'PC201/PC200 - Cook for up to 8-10 people. 6.5 qt nonstick cooking pot.',
        'demo-apac-sa-capacity-claim',
      ],
      ['PC-006c', 'cook for up to 6-8 servings', 'demo-apac-sa-capacity-claim'],
      ['PC-006d', 'feeds up to 10 people', 'demo-apac-sa-capacity-claim'],
      ['PC-012', 'Comparison with higher-end Joyoung model', 'demo-apac-sa-comparative-claim'],
      ['PC-015', 'Comparison may make competitor look better', 'demo-apac-sa-comparative-claim'],
      ['BL-005', 'Quieter by design', 'demo-apac-sa-comparative-claim'],
      ['BL-006', 'No chunks', 'demo-apac-sa-absolute-claim-soft'],
      ['BL-014', 'Finer blending smoother nutrition', 'demo-apac-sa-comparative-claim'],
      ['BL-015', 'Ordinary Blender comparison', 'demo-apac-sa-comparative-claim'],
      ['RC18-003', 'Safer and more durable', 'demo-apac-sa-comparative-claim'],
      ['RC18-004', 'China Patent', 'demo-apac-sa-patent-claim'],
      ['RC18-006', 'A cleaner way to cook', 'demo-apac-sa-comparative-claim'],
      ['RC18-007', 'Less peeling', 'demo-apac-sa-comparative-claim'],
      ['RC40-006', 'Up to 16 bowls', 'demo-apac-sa-capacity-claim'],
      ['RC40-009', 'Wrong SKU content (actually 50H100)', 'demo-apac-sa-wrong-sku'],
      ['LZ585-001', 'Zero waste', 'demo-apac-sa-absolute-claim-soft'],
      ['GEN-004', 'Traditional / Ordinary comparison', 'demo-apac-sa-comparative-claim'],
    ])('detects Golden Medium risk %s', (_caseId, text, ruleId) => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('SG', text));

      expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
    });

    it.each([
      ['PC-011', '22:00pm', 'demo-apac-sa-grammar-quality'],
      ['PC-014', 'Missing AI disclaimer', 'demo-apac-sa-ai-image-disclaimer'],
      ['BL-003', 'Multiple presents', 'demo-apac-sa-grammar-quality'],
      ['BL-013', 'Missing AI disclaimer', 'demo-apac-sa-ai-image-disclaimer'],
      ['RC18-005', 'Missing AI disclaimer', 'demo-apac-sa-ai-image-disclaimer'],
      ['RC40-008', 'Missing AI disclaimer', 'demo-apac-sa-ai-image-disclaimer'],
      ['LZ585-002', "What's include", 'demo-apac-sa-grammar-quality'],
      ['GEN-006', 'Missing AI generated disclaimer', 'demo-apac-sa-ai-image-disclaimer'],
    ])('detects Golden Low risk %s', (_caseId, text, ruleId) => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('SG', text));

      expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
    });

    it('WARN on AI rendered image without disclaimer (modality rule)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate({
        ...saContext('SG', 'Premium air fryer hero'),
        normalizedContent: {
          text: 'Premium air fryer hero',
          imageUrls: ['https://demo/ad.png'],
          ocrText: 'Dual heat zones',
        },
        advertisementContext: { aiRenderedImage: true },
      });

      expect(
        result.findings.some((f) => f.refId === 'demo-apac-sa-ai-image-disclaimer'),
      ).toBe(true);
    });

    it('WARN on when-only modality rules (CJK localization)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate({
        ...saContext('SG', 'Product hero'),
        normalizedContent: {
          text: 'Product hero',
          imageUrls: ['https://demo/ad.png'],
          ocrText: '美的智能家电',
        },
        advertisementContext: {},
      });

      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-localization-cjk')).toBe(
        true,
      );
    });

    it('WARN on SKU mismatch when productSku context is set', () => {
      const service = new RuleEngineService();
      const result = service.evaluate({
        ...saContext('SG', 'Rice cooker banner'),
        normalizedContent: {
          text: 'Rice cooker banner',
          imageUrls: [],
          ocrText: 'Model 50H100 stainless steel',
        },
        advertisementContext: { productSku: 'RC40' },
      });

      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-wrong-sku')).toBe(true);
    });

    it('downgrades VN absolute claims to WARN via country_decision_overrides', () => {
      const service = new RuleEngineService();
      const result = service.evaluate({
        ...saContext('VN', 'Máy hút bụi tốt nhất'),
        normalizedContent: {
          text: 'Máy hút bụi tốt nhất trên thị trường',
          imageUrls: [],
        },
      });

      const finding = result.findings.find((f) => f.refId === 'demo-apac-sa-absolute-claim');
      expect(finding).toBeDefined();
      expect(finding?.decision).toBe('WARN');
      expect(finding?.severity).toBe('MEDIUM');
      expect(result.hasBlocker).toBe(false);
    });

    it('downgrades TH absolute claims for every single time to WARN via term-level overrides', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(
        saContext('TH', 'Foolproof rice cooking every single time'),
      );

      const finding = result.findings.find((f) => f.refId === 'demo-apac-sa-absolute-claim');
      expect(finding).toBeDefined();
      expect(finding?.decision).toBe('WARN');
      expect(finding?.severity).toBe('MEDIUM');
      expect(result.hasBlocker).toBe(false);
    });

    it('downgrades TH soft absolute claims for perfect to WARN', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('TH', 'Easy presents for perfect results'));

      const finding = result.findings.find((f) => f.refId === 'demo-apac-sa-absolute-claim-soft');
      expect(finding).toBeDefined();
      expect(finding?.decision).toBe('WARN');
      expect(finding?.severity).toBe('MEDIUM');
      expect(result.hasBlocker).toBe(false);
    });

    it('REJECT on Chinese world-first absolute claims (世界第一)', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('SG', '世界第一电饭煲'));

      expect(result.hasBlocker).toBe(true);
      expect(result.findings.some((f) => f.refId === 'demo-apac-sa-absolute-claim')).toBe(true);
    });

    it.each([
      ['全球第一豆浆机', 'demo-apac-sa-absolute-claim'],
      ['行业第一破壁机', 'demo-apac-sa-absolute-claim'],
    ])('REJECT on Chinese first-in-class absolute: %s', (text, ruleId) => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('SG', text));

      expect(result.hasBlocker).toBe(true);
      expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
    });

    it.each([
      ['九阳销量第一', 'demo-apac-sa-comparative-claim'],
      ['泰国销量排名第一', 'demo-apac-sa-comparative-claim'],
    ])('WARN on Chinese sales-rank comparative: %s', (text, ruleId) => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('TH', text));

      expect(result.hasBlocker).toBe(false);
      expect(result.findings.some((f) => f.refId === ruleId)).toBe(true);
    });

    it('keeps TH absolute claims at FAIL for non-overridden terms', () => {
      const service = new RuleEngineService();
      const result = service.evaluate(saContext('TH', 'the best machine ever'));

      const finding = result.findings.find((f) => f.refId === 'demo-apac-sa-absolute-claim');
      expect(finding).toBeDefined();
      expect(finding?.decision).toBe('FAIL');
      expect(finding?.severity).toBe('BLOCKER');
      expect(result.hasBlocker).toBe(true);
    });

    it('fires ID product-category-boundary on Bahasa health vocabulary in sa.*', () => {
      const service = new RuleEngineService();
      const result = service.evaluate({
        ...saContext('ID', 'Blender dengan khasiat alami'),
        normalizedContent: {
          text: 'Blender dengan khasiat alami untuk kesehatan',
          imageUrls: [],
        },
      });

      expect(
        result.findings.some((f) => f.refId === 'demo-id-product-category-boundary'),
      ).toBe(true);
    });

    it('elevates PH health-implication severity to HIGH', () => {
      const service = new RuleEngineService();
      const result = service.evaluate({
        ...saContext('PH', 'Para sa kalusugan'),
        normalizedContent: {
          text: 'Air fryer para sa kalusugan ng pamilya',
          imageUrls: [],
        },
      });

      const finding = result.findings.find((f) => f.refId === 'demo-apac-sa-health-implication');
      expect(finding?.severity).toBe('HIGH');
      expect(finding?.decision).toBe('REVIEW');
    });
  });
});
