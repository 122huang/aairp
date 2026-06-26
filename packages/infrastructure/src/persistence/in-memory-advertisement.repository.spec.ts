import { describe, expect, it } from 'vitest';
import { InMemoryAdvertisementRepository } from './in-memory-advertisement.repository.js';

describe('InMemoryAdvertisementRepository', () => {
  it('save and findById return the same advertisement', async () => {
    const repository = new InMemoryAdvertisementRepository();
    const advertisement = {
      advertisementId: 'ad_test',
      tenantId: 'demo',
      countryId: 'SG',
      platformId: 'META',
      categoryId: 'health.supplement',
      content: { text: 'hello', images: [] },
      context: {},
      tags: [],
      contentHash: 'hash',
      contentVersion: 1,
      parentAdvertisementId: null,
      status: 'PENDING_REVIEW' as const,
      uploadedAt: '2026-06-26T10:00:00.000Z',
    };

    await repository.save(advertisement);

    expect(await repository.findById('ad_test')).toEqual(advertisement);
    expect(await repository.findById('missing')).toBeNull();
  });
});
