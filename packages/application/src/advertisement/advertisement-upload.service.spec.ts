import { describe, expect, it, vi } from 'vitest';
import {
  AdvertisementUploadService,
  AdvertisementUploadValidationError,
} from './advertisement-upload.service.js';
import type { IAdvertisementRepository, NormalizedAdvertisement } from '@aairp/domain';

function createRepository(): IAdvertisementRepository {
  return {
    save: vi.fn(async (advertisement) => advertisement),
    findById: vi.fn().mockResolvedValue(null),
  };
}

describe('AdvertisementUploadService', () => {
  const fixedDate = new Date('2026-06-26T10:00:00.000Z');
  const fixedId = '11111111-1111-1111-1111-111111111111';

  it('upload normalizes a valid payload and saves it', async () => {
    const repository = createRepository();
    const service = new AdvertisementUploadService(repository, {
      now: () => fixedDate,
      createId: () => fixedId,
    });

    const result = await service.upload({
      country_id: 'sg',
      platform_id: 'meta',
      category_id: 'health.supplement',
      content: {
        text: '  Buy now  ',
        landing_url: 'https://example.com',
      },
      tags: ['campaign:summer'],
    });

    expect(result).toMatchObject({
      advertisementId: `ad_${fixedId}`,
      tenantId: 'demo',
      countryId: 'SG',
      platformId: 'META',
      categoryId: 'health.supplement',
      content: {
        text: 'Buy now',
        images: [],
        landingUrl: 'https://example.com',
      },
      contentVersion: 1,
      status: 'PENDING_REVIEW',
      uploadedAt: '2026-06-26T10:00:00.000Z',
    });
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('upload rejects missing required fields', async () => {
    const repository = createRepository();
    const service = new AdvertisementUploadService(repository);

    await expect(
      service.upload({
        platform_id: 'META',
        category_id: 'health.supplement',
        content: { text: 'hello' },
      }),
    ).rejects.toBeInstanceOf(AdvertisementUploadValidationError);
  });

  it('upload rejects empty content', async () => {
    const repository = createRepository();
    const service = new AdvertisementUploadService(repository);

    await expect(
      service.upload({
        country_id: 'SG',
        platform_id: 'META',
        category_id: 'health.supplement',
        content: {},
      }),
    ).rejects.toBeInstanceOf(AdvertisementUploadValidationError);
  });

  it('content_hash hashes content only and ignores dimensions', async () => {
    const repository = createRepository();
    const service = new AdvertisementUploadService(repository, {
      now: () => fixedDate,
      createId: () => fixedId,
    });

    const content = { text: 'Same ad copy', images: ['https://cdn.example.com/a.png'] };

    const sg = await service.upload({
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'health.supplement',
      content,
      tags: ['a'],
    });

    const us = await service.upload({
      country_id: 'US',
      platform_id: 'TIKTOK',
      category_id: 'beauty.skincare',
      content,
      tags: ['b'],
      context: { campaign_type: 'awareness' },
    });

    expect(sg.contentHash).toBe(us.contentHash);
    expect(sg.countryId).not.toBe(us.countryId);
  });
});
