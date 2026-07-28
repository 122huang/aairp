import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSliceThumbnailDataUrl,
  cropImageDataUrlForSlice,
  defaultFixtureRoot,
  probeImageDimensions,
} from './image-slice-crop.js';

async function createTestDataUrl(width: number, height: number): Promise<string> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

describe('image-slice-crop', () => {
  it('probes dimensions from a data URL image', async () => {
    const dataUrl = await createTestDataUrl(400, 9651);
    const dimensions = await probeImageDimensions(dataUrl);
    expect(dimensions).toEqual({ width: 400, height: 9651 });
  });

  it('crops a vertical band from a data URL image', async () => {
    const dataUrl = await createTestDataUrl(400, 9651);
    const cropped = await cropImageDataUrlForSlice(dataUrl, { yStart: 0, yEnd: 2000 / 9651 });
    const dimensions = await probeImageDimensions(cropped);
    expect(dimensions?.width).toBe(400);
    expect(dimensions?.height).toBe(2000);
  });

  it('loads fixture://image-compliance URLs from the benchmark fixture root', async () => {
    const fixtureUrl = 'fixture://image-compliance/cn-pdp-pressure-cooker-pos.jpg';
    const dimensions = await probeImageDimensions(fixtureUrl);
    expect(dimensions?.width).toBe(750);
    expect(dimensions?.height).toBe(15000);
    expect(defaultFixtureRoot).toContain('image-compliance');
  });

  it('creates a resized thumbnail data URL for a slice', async () => {
    const dataUrl = await createTestDataUrl(800, 4000);
    const thumb = await createSliceThumbnailDataUrl(dataUrl, { yStart: 0.25, yEnd: 0.5 }, 240);
    expect(thumb.startsWith('data:image/jpeg;base64,')).toBe(true);
    const dimensions = await probeImageDimensions(thumb);
    expect(dimensions?.width).toBeLessThanOrEqual(240);
  });

  it('reads local file paths when provided', async () => {
    const fixturePath = join(defaultFixtureRoot, 'cn-pdp-pressure-cooker-pos.jpg');
    const dimensions = await probeImageDimensions(fixturePath);
    expect(dimensions?.width).toBe(750);
  });
});
