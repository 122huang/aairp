import { describe, expect, it } from 'vitest';
import { toReviewContextResponseDto } from './review-context.dto.js';
import { DEMO_KNOWLEDGE_VERSIONS } from '@aairp/application';

describe('toReviewContextResponseDto', () => {
  it('maps ReviewContext to snake_case response', () => {
    expect(
      toReviewContextResponseDto({
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
          text: 'hello',
          imageUrls: ['https://cdn.example.com/a.png'],
          ocrText: 'ocr',
        },
        resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
        advertisementContext: { campaignType: 'conversion' },
        tags: ['campaign:demo'],
        builtAt: '2026-06-26T10:05:00.000Z',
      }),
    ).toEqual({
      review_id: 'rev_test',
      advertisement_id: 'ad_test',
      content_hash: 'hash123',
      content_version: 1,
      dimensions: {
        tenant_id: 'demo',
        country_id: 'SG',
        platform_id: 'META',
        category_id: 'health.supplement',
      },
      normalized_content: {
        text: 'hello',
        image_urls: ['https://cdn.example.com/a.png'],
        ocr_text: 'ocr',
      },
      resolved_knowledge_versions: {
        rule_pack_version: DEMO_KNOWLEDGE_VERSIONS.rulePackVersion,
        policy_pack_version: DEMO_KNOWLEDGE_VERSIONS.policyPackVersion,
        playbook_pack_version: DEMO_KNOWLEDGE_VERSIONS.playbookPackVersion,
      },
      advertisement_context: { campaign_type: 'conversion' },
      tags: ['campaign:demo'],
      built_at: '2026-06-26T10:05:00.000Z',
    });
  });

  it('maps landingUrl to landing_page_text in API response for demo compatibility', () => {
    expect(
      toReviewContextResponseDto({
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
          text: 'hello',
          imageUrls: [],
          landingUrl: 'https://example.com/promo',
        },
        resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
        advertisementContext: {},
        tags: [],
        builtAt: '2026-06-26T10:05:00.000Z',
      }).normalized_content,
    ).toEqual({
      text: 'hello',
      image_urls: [],
      landing_page_text: 'https://example.com/promo',
    });
  });
});
