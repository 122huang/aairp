import { describe, expect, it } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { VisionComplianceService } from './vision-compliance.service.js';

const baseContext: ReviewContext = {
  reviewId: 'rev_vision_test',
  advertisementId: 'ad_vision_test',
  contentHash: 'hash_vision',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'SHOPEE',
    categoryId: 'sa.air_fryer',
  },
  normalizedContent: {
    text: 'Air fryer promo',
    imageUrls: ['https://example.com/pdp.jpg'],
    imageDimensions: [{ width: 800, height: 3200 }],
  },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-06-29T00:00:00.000Z',
};

describe('VisionComplianceService', () => {
  it('skips when vision mode is off', async () => {
    const previous = process.env.AAIRP_VISION_MODE;
    process.env.AAIRP_VISION_MODE = 'off';

    try {
      const service = new VisionComplianceService();
      const result = await service.discover(baseContext);

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('VISION_MODE_OFF');
      expect(result.findings).toEqual([]);
    } finally {
      if (previous === undefined) {
        delete process.env.AAIRP_VISION_MODE;
      } else {
        process.env.AAIRP_VISION_MODE = previous;
      }
    }
  });

  it('returns structured empty findings in stub mode', async () => {
    const previous = process.env.AAIRP_VISION_MODE;
    process.env.AAIRP_VISION_MODE = 'stub';

    try {
      const service = new VisionComplianceService();
      const result = await service.discover(baseContext);

      expect(result.skipped).toBe(false);
      expect(result.promptPackVersion).toBe('demo-vision-1.0.0');
      expect(result.findings).toEqual([]);
      expect(result.manifests).toHaveLength(1);
      expect(result.manifests[0]?.slices.length).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) {
        delete process.env.AAIRP_VISION_MODE;
      } else {
        process.env.AAIRP_VISION_MODE = previous;
      }
    }
  });
});
