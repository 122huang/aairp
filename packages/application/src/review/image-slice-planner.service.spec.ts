import { describe, expect, it } from 'vitest';
import type { ImageContentBlockHint } from '@aairp/shared-kernel';
import { ImageSlicePlannerService } from './image-slice-planner.service.js';

describe('ImageSlicePlannerService', () => {
  const planner = new ImageSlicePlannerService();

  it('returns a single hero slice for short images', () => {
    const manifests = planner.plan({
      imageUrls: ['https://example.com/banner.jpg'],
      dimensionsByImage: [{ width: 1200, height: 600 }],
    });

    expect(manifests).toHaveLength(1);
    expect(manifests[0]?.plannerMode).toBe('content_blocks');
    expect(manifests[0]?.slices).toHaveLength(1);
    expect(manifests[0]?.slices[0]?.sliceType).toBe('hero');
  });

  it('uses content block bands for long images', () => {
    const manifests = planner.plan({
      imageUrls: ['https://example.com/pdp.jpg'],
      dimensionsByImage: [{ width: 800, height: 3200 }],
    });

    expect(manifests[0]?.plannerMode).toBe('content_blocks');
    expect(manifests[0]?.slices.map((slice) => slice.sliceType)).toEqual([
      'hero',
      'claims',
      'specs',
      'certification',
    ]);
  });

  it('honours manual manifest override', () => {
    const manifests = planner.plan({
      imageUrls: ['https://example.com/manual.jpg'],
      manualManifestByImage: [
        [
          {
            sliceId: 'custom-s0',
            sourceImageIndex: 0,
            sliceIndex: 0,
            sliceType: 'claims',
            yStart: 0.1,
            yEnd: 0.4,
          },
        ],
      ],
    });

    expect(manifests[0]?.plannerMode).toBe('manual');
    expect(manifests[0]?.slices[0]?.sliceId).toBe('custom-s0');
  });

  it('falls back to fixed-height bands when blocks cannot be identified', () => {
    const manifests = planner.plan({
      imageUrls: ['https://example.com/tall.jpg'],
      dimensionsByImage: [{ width: 900, height: 1200 }],
    });

    expect(manifests[0]?.plannerMode).toBe('fixed_height_fallback');
    expect(manifests[0]?.fallbackReason).toContain('unable_to_identify_content_blocks');
    expect(manifests[0]?.slices.length).toBeGreaterThan(1);
  });

  it('uses provided content block hints', () => {
    const hints: ImageContentBlockHint[] = [
      { blockType: 'hero', yStart: 0, yEnd: 0.2 },
      { blockType: 'claims', yStart: 0.2, yEnd: 0.6 },
      { blockType: 'specs', yStart: 0.6, yEnd: 1 },
    ];

    const manifests = planner.plan({
      imageUrls: ['https://example.com/hints.jpg'],
      contentBlockHintsByImage: [hints],
    });

    expect(manifests[0]?.plannerMode).toBe('content_blocks');
    expect(manifests[0]?.slices).toHaveLength(3);
    expect(manifests[0]?.slices[0]?.plannerHint).toBe('provided_content_blocks');
  });
});
