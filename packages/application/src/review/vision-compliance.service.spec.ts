import { describe, expect, it } from 'vitest';
import type { ImageSlice, ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import {
  renderVisionPrompt,
  resolveVisionAdTextReference,
  VisionComplianceService,
} from './vision-compliance.service.js';

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

const sampleSlice: ImageSlice = {
  sliceId: 'slice_0',
  sourceImageIndex: 0,
  sliceIndex: 0,
  sliceType: 'full',
  yStart: 0,
  yEnd: 1,
};

describe('VisionComplianceService', () => {
  it('injects market language guidance when ad text is empty', () => {
    const context: ReviewContext = {
      ...baseContext,
      normalizedContent: {
        text: '',
        imageUrls: ['https://example.com/pdp.jpg'],
        imageDimensions: [{ width: 800, height: 3200 }],
      },
    };

    expect(resolveVisionAdTextReference(context)).toContain('Target market is SG');
    expect(resolveVisionAdTextReference(context)).toContain(
      'non-English, non-local-language text visible on product panels',
    );

    const prompt = renderVisionPrompt('Ad text: {ad_text}', context, sampleSlice);
    expect(prompt).toContain('Target market is SG');
    expect(prompt).not.toMatch(/Ad text:\s*$/);
  });

  it('returns panel_language findings for image-only stub scenario', async () => {
    const previous = process.env.AAIRP_VISION_MODE;
    process.env.AAIRP_VISION_MODE = 'stub';

    try {
      const service = new VisionComplianceService();
      const result = await service.discover({
        ...baseContext,
        normalizedContent: {
          text: '',
          imageUrls: ['https://cdn.example.com/cn-panel-unreplaced-pos.jpg'],
          imageDimensions: [{ width: 800, height: 1200 }],
        },
      });

      expect(result.skipped).toBe(false);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(
        result.findings.some(
          (finding) => finding.evaluationDetail?.scanDimension === 'panel_language',
        ),
      ).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.AAIRP_VISION_MODE;
      } else {
        process.env.AAIRP_VISION_MODE = previous;
      }
    }
  });

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
