import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { cropImageDataUrlForSlice, probeImageDimensions } from './image-slice-crop.js';

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
});
