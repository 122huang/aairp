import { describe, expect, it } from 'vitest';
import type { ImageSlice, ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import {
  describeVisionImageReference,
  estimateVisionInputTokens,
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
  sliceType: 'hero',
  yStart: 0,
  yEnd: 1,
};

describe('VisionComplianceService', () => {
  it('omits inline base64 from prompt image_url placeholder', () => {
    const dataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(500_000);
    const context: ReviewContext = {
      ...baseContext,
      normalizedContent: {
        text: '',
        imageUrls: [dataUrl],
        imageDimensions: [{ width: 400, height: 9651 }],
      },
    };

    expect(describeVisionImageReference(dataUrl)).toBe('attached-inline-slice');

    const prompt = renderVisionPrompt(
      'Image URL: {image_url}',
      context,
      { ...sampleSlice, sliceIndex: 2, yStart: 0.4, yEnd: 0.6 },
    );

    expect(prompt).toContain('attached-inline-slice');
    expect(prompt).not.toContain('AAAA');
    expect(estimateVisionInputTokens(prompt, 'data:image/jpeg;base64,' + 'B'.repeat(160_000))).toBeLessThan(
      262_144,
    );
  });

  it('calls vision gateway once per slice with cropped image only', async () => {
    const previous = process.env.AAIRP_VISION_MODE;
    process.env.AAIRP_VISION_MODE = 'stub';

    const calls: Array<{ sliceIndex: number; imageUrl: string; prompt: string }> = [];
    const service = new VisionComplianceService({
      llmGateway: {
        async complete(prompt, options) {
          const match = prompt.match(/Slice index: (\d+)/);
          calls.push({
            sliceIndex: Number(match?.[1] ?? -1),
            imageUrl: options?.imageUrl ?? '',
            prompt,
          });
          return {
            content: JSON.stringify({
              prompt_pack_version: 'demo-vision-1.0.0',
              extracted_text: [],
              findings: [],
            }),
          };
        },
      },
      cropImageForSlice: async (_source, slice) =>
        `data:image/jpeg;base64,slice-${slice.sliceIndex}`,
      createSliceThumbnail: async (_source, slice) =>
        `data:image/jpeg;base64,thumb-${slice.sliceIndex}`,
      promptTemplate: 'Slice index: {slice_index}\nImage URL: {image_url}',
    });

    try {
      await service.discover({
        ...baseContext,
        normalizedContent: {
          text: '',
          imageUrls: ['data:image/jpeg;base64,full-image'],
          imageDimensions: [{ width: 400, height: 9651 }],
        },
      });

      expect(calls).toHaveLength(6);
      expect(calls.map((call) => call.sliceIndex).sort((a, b) => a - b)).toEqual([
        0, 1, 2, 3, 4, 5,
      ]);
      for (const call of calls) {
        expect(call.imageUrl).toMatch(/^data:image\/jpeg;base64,slice-\d+$/);
        expect(call.prompt).toContain('attached-inline-slice');
        expect(call.prompt).not.toContain('full-image');
      }
    } finally {
      if (previous === undefined) {
        delete process.env.AAIRP_VISION_MODE;
      } else {
        process.env.AAIRP_VISION_MODE = previous;
      }
    }
  });

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
      const service = new VisionComplianceService({
        // Avoid remote fetch hangs on example.com URLs in unit tests.
        disableHeuristicSegmentation: true,
        disableImageEnhance: true,
        cropImageForSlice: async (_source, slice) =>
          `data:image/jpeg;base64,slice-${slice.sliceIndex}`,
        createSliceThumbnail: async (_source, slice) =>
          `data:image/jpeg;base64,thumb-${slice.sliceIndex}`,
      });
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
  }, 15_000);

  it('returns slice thumbnails and consistency findings for multi-slice pressure cooker fixture', async () => {
    const previous = process.env.AAIRP_VISION_MODE;
    process.env.AAIRP_VISION_MODE = 'stub';

    try {
      const service = new VisionComplianceService();
      const result = await service.discover({
        ...baseContext,
        normalizedContent: {
          text: '',
          imageUrls: ['fixture://image-compliance/cn-pdp-pressure-cooker-pos.jpg'],
          imageDimensions: [{ width: 750, height: 15000 }],
          imageContentBlockHints: [
            [
              { blockType: 'hero', yStart: 0, yEnd: 0.08 },
              { blockType: 'claims', yStart: 0.08, yEnd: 0.18 },
              { blockType: 'specs', yStart: 0.18, yEnd: 0.33 },
              { blockType: 'lifestyle', yStart: 0.33, yEnd: 0.46 },
              { blockType: 'comparison', yStart: 0.46, yEnd: 0.58 },
              { blockType: 'certification', yStart: 0.58, yEnd: 0.74 },
              { blockType: 'footer', yStart: 0.74, yEnd: 1 },
            ],
          ],
        },
      });

      expect(result.skipped).toBe(false);
      expect(Object.keys(result.sliceThumbnails ?? {}).length).toBeGreaterThan(0);
      expect(result.consistencyFindings?.length).toBeGreaterThan(0);
      // 750px width uses per-slice enhance (not full-canvas); preprocess may be empty.
    } finally {
      if (previous === undefined) {
        delete process.env.AAIRP_VISION_MODE;
      } else {
        process.env.AAIRP_VISION_MODE = previous;
      }
    }
  }, 20_000);
});
