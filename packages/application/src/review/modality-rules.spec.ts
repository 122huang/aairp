import { describe, expect, it } from 'vitest';
import { fieldsContainCjk, matchesRuleWhen } from './modality-rules.js';
import type { ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import {
  extractModelTokens,
  findSkuMismatchToken,
  skuTokensMatch,
} from './modality-rules.js';

const baseContext: ReviewContext = {
  reviewId: 'rev_test',
  advertisementId: 'ad_test',
  contentHash: 'hash',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'META',
    categoryId: 'electronics',
  },
  normalizedContent: { text: 'Hero shot', imageUrls: ['https://demo/ad.png'] },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: { aiRenderedImage: true },
  tags: [],
  builtAt: '2026-06-26T10:00:00.000Z',
};

describe('modality-rules', () => {
  it('matchesRuleWhen checks images and ai_rendered_image', () => {
    expect(
      matchesRuleWhen(baseContext, { has_images: true, ai_rendered_image: true }),
    ).toBe(true);
    expect(matchesRuleWhen(baseContext, { ai_rendered_image: false })).toBe(false);
    expect(
      matchesRuleWhen(
        { ...baseContext, normalizedContent: { text: 'x', imageUrls: [] } },
        { has_images: true },
      ),
    ).toBe(false);
  });

  it('extractModelTokens finds product codes', () => {
    expect(extractModelTokens('Model 50H100 on banner')).toEqual(['50H100']);
    expect(skuTokensMatch('RC40', 'RC40-006')).toBe(true);
    expect(skuTokensMatch('RC40', '50H100')).toBe(false);
  });

  it('fieldsContainCjk detects Chinese in OCR', () => {
    expect(fieldsContainCjk([{ field: 'ocr_text', value: '美的电饭煲' }])).toBe(true);
    expect(fieldsContainCjk([{ field: 'text', value: 'English only' }])).toBe(false);
  });

  it('matchesRuleWhen checks CPSR/COE category prerequisites', () => {
    expect(matchesRuleWhen(baseContext, { category_requires_cpsr: true })).toBe(true);
    expect(
      matchesRuleWhen(
        {
          ...baseContext,
          dimensions: { ...baseContext.dimensions, categoryId: 'health.supplement' },
        },
        { category_requires_cpsr: true },
      ),
    ).toBe(false);
    expect(
      matchesRuleWhen(
        {
          ...baseContext,
          dimensions: { ...baseContext.dimensions, countryId: 'MY', categoryId: 'sa.air_fryer' },
        },
        { category_requires_coe: true },
      ),
    ).toBe(true);
  });

  it('matchesRuleWhen checks audience_includes_children', () => {
    expect(
      matchesRuleWhen(
        {
          ...baseContext,
          normalizedContent: { text: 'Fun for kids', imageUrls: [] },
        },
        { audience_includes_children: true },
      ),
    ).toBe(true);
    expect(matchesRuleWhen(baseContext, { audience_includes_children: true })).toBe(false);
  });

  it('matchesRuleWhen checks ad_type_in and or_missing_ad_type', () => {
    expect(
      matchesRuleWhen(
        { ...baseContext, advertisementContext: { adType: 'INFLUENCER_UGC' } },
        { ad_type_in: ['INFLUENCER_UGC'], or_missing_ad_type: true },
      ),
    ).toBe(true);
    expect(
      matchesRuleWhen(
        { ...baseContext, advertisementContext: {} },
        { ad_type_in: ['INFLUENCER_UGC'], or_missing_ad_type: true },
      ),
    ).toBe(true);
    expect(
      matchesRuleWhen(
        { ...baseContext, advertisementContext: { adType: 'BRAND_PRODUCT' } },
        { ad_type_in: ['INFLUENCER_UGC'], or_missing_ad_type: true },
      ),
    ).toBe(false);
  });
});
