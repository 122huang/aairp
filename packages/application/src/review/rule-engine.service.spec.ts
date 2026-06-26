import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { RuleEngineService } from './rule-engine.service.js';

const demoRulesAssetPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/rules.demo.json',
);

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
    expect(result.rulePackVersion).toBe('demo-rule-1.0.0');
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

  it('returns WARN findings for superlative claims and missing disclosure', () => {
    const service = new RuleEngineService();

    const result = service.evaluate(baseContext);

    expect(result.findings.some((finding) => finding.refId === 'demo-sg-health-superlative')).toBe(
      true,
    );
    expect(
      result.findings.some((finding) => finding.refId === 'demo-sg-sponsored-disclosure'),
    ).toBe(true);

    const disclosure = result.findings.find(
      (finding) => finding.refId === 'demo-sg-sponsored-disclosure',
    );
    expect(disclosure?.evaluationDetail).toBeUndefined();
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
    expect(asset.rules).toHaveLength(3);

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

    const disclosedResult = service.evaluate({
      ...scopeContext,
      normalizedContent: {
        text: `Buy wellness supplements today ${disclosureRule.required_any_terms![0]!}`,
        imageUrls: [],
      },
    });
    expect(
      disclosedResult.findings.some((finding) => finding.refId === disclosureRule.rule_id),
    ).toBe(false);
  });

  it('evaluates injected rulePack identically to hardcoded path', () => {
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
        citation?: { law_name: string; article?: string };
      }>;
    };

    const hardcoded = new RuleEngineService().evaluate(baseContext);
    const fromPack = new RuleEngineService({
      rulePack: {
        pack_version: asset.pack_version,
        rules: asset.rules.map((rule) => ({
          rule_id: rule.rule_id,
          rule_version_id: rule.rule_version_id,
          severity: rule.severity,
          decision: rule.decision,
          summary: rule.summary,
          scopes: rule.scopes,
          forbidden_terms: rule.forbidden_terms,
          trigger_terms: rule.trigger_terms,
          required_any_terms: rule.required_any_terms,
          citation: rule.citation
            ? { lawName: rule.citation.law_name, article: rule.citation.article }
            : undefined,
        })),
      },
    }).evaluate(baseContext);

    expect(fromPack.hasBlocker).toBe(hardcoded.hasBlocker);
    expect(fromPack.findings.map((f) => f.refId).sort()).toEqual(
      hardcoded.findings.map((f) => f.refId).sort(),
    );
  });
});
