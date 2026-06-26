import { describe, expect, it } from 'vitest';
import { toAdvertisementUploadResponseDto } from './advertisement-upload.dto.js';

describe('toAdvertisementUploadResponseDto', () => {
  it('maps normalized advertisement to snake_case response', () => {
    expect(
      toAdvertisementUploadResponseDto({
        advertisementId: 'ad_test',
        tenantId: 'demo',
        countryId: 'SG',
        platformId: 'META',
        categoryId: 'health.supplement',
        content: {
          text: 'hello',
          images: [],
          landingUrl: 'https://example.com',
        },
        context: { campaignType: 'conversion' },
        tags: ['campaign:demo'],
        contentHash: 'abc123',
        contentVersion: 1,
        parentAdvertisementId: null,
        status: 'PENDING_REVIEW',
        uploadedAt: '2026-06-26T10:00:00.000Z',
      }),
    ).toEqual({
      advertisement_id: 'ad_test',
      tenant_id: 'demo',
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content: {
        text: 'hello',
        images: [],
        landing_url: 'https://example.com',
      },
      context: { campaign_type: 'conversion' },
      tags: ['campaign:demo'],
      content_hash: 'abc123',
      content_version: 1,
      parent_advertisement_id: null,
      status: 'PENDING_REVIEW',
      uploaded_at: '2026-06-26T10:00:00.000Z',
    });
  });
});
