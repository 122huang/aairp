import { describe, expect, it, vi } from 'vitest';
import {
  AdvertisementNotFoundError,
  ContextBuilderService,
  DEMO_KNOWLEDGE_VERSIONS,
} from './context-builder.service.js';
import type { IAdvertisementRepository, NormalizedAdvertisement } from '@aairp/domain';

const sampleAdvertisement: NormalizedAdvertisement = {
  advertisementId: 'ad_test',
  tenantId: 'demo',
  countryId: 'SG',
  platformId: 'META',
  categoryId: 'health.supplement',
  content: {
    text: 'Buy now',
    images: ['https://cdn.example.com/a.png'],
    landingUrl: 'https://example.com/promo',
    ocrText: 'OCR text',
  },
  context: { campaignType: 'conversion', adFormat: 'image' },
  tags: ['campaign:demo'],
  contentHash: 'hash123',
  contentVersion: 1,
  parentAdvertisementId: null,
  status: 'PENDING_REVIEW',
  uploadedAt: '2026-06-26T10:00:00.000Z',
};

function createRepository(
  advertisement: NormalizedAdvertisement | null = sampleAdvertisement,
): IAdvertisementRepository {
  return {
    save: vi.fn(),
    findById: vi.fn().mockResolvedValue(advertisement),
  };
}

describe('ContextBuilderService', () => {
  const fixedDate = new Date('2026-06-26T10:05:00.000Z');

  it('buildFromAdvertisement maps NormalizedAdvertisement to ReviewContext', () => {
    const service = new ContextBuilderService(createRepository(), {
      now: () => fixedDate,
      createReviewId: () => '11111111-1111-1111-1111-111111111111',
    });

    const context = service.buildFromAdvertisement(sampleAdvertisement);

    expect(context).toEqual({
      reviewId: 'rev_11111111-1111-1111-1111-111111111111',
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
        text: 'Buy now',
        ocrText: 'OCR text',
        landingUrl: 'https://example.com/promo',
        imageUrls: ['https://cdn.example.com/a.png'],
      },
      resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
      advertisementContext: { campaignType: 'conversion', adFormat: 'image' },
      tags: ['campaign:demo'],
      builtAt: '2026-06-26T10:05:00.000Z',
    });
  });

  it('buildFromAdvertisementId loads advertisement from repository', async () => {
    const repository = createRepository();
    const service = new ContextBuilderService(repository);

    const context = await service.buildFromAdvertisementId('ad_test');

    expect(repository.findById).toHaveBeenCalledWith('ad_test');
    expect(context.advertisementId).toBe('ad_test');
  });

  it('buildFromAdvertisementId throws when advertisement is missing', async () => {
    const service = new ContextBuilderService(createRepository(null));

    await expect(service.buildFromAdvertisementId('missing')).rejects.toBeInstanceOf(
      AdvertisementNotFoundError,
    );
  });

  it('uses configured knowledge versions', () => {
    const service = new ContextBuilderService(createRepository(), {
      knowledgeVersions: {
        rulePackVersion: 'custom-rule',
        policyPackVersion: 'custom-policy',
        playbookPackVersion: 'custom-playbook',
      },
    });

    const context = service.buildFromAdvertisement(sampleAdvertisement);

    expect(context.resolvedKnowledgeVersions).toEqual({
      rulePackVersion: 'custom-rule',
      policyPackVersion: 'custom-policy',
      playbookPackVersion: 'custom-playbook',
    });
  });
});
