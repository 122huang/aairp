import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { detectContentBlocksFromImage } from './image-section-segmenter.js';

async function createSectionedDataUrl(): Promise<{ dataUrl: string; width: number; height: number }> {
  const width = 750;
  const height = 6000;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="1200" fill="rgb(20,20,30)" />
    <rect x="0" y="1200" width="${width}" height="1500" fill="rgb(80,80,90)" />
    <rect x="0" y="2700" width="${width}" height="1800" fill="rgb(40,90,120)" />
    <rect x="0" y="4500" width="${width}" height="1500" fill="rgb(120,60,40)" />
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).jpeg().toBuffer();
  return {
    dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
    width,
    height,
  };
}

describe('image-section-segmenter', () => {
  it('detects multiple content blocks from a synthetic long image', async () => {
    const { dataUrl, width, height } = await createSectionedDataUrl();
    const blocks = await detectContentBlocksFromImage(dataUrl, { width, height });
    expect(blocks).toBeDefined();
    expect(blocks!.length).toBeGreaterThanOrEqual(3);
    expect(blocks![0]?.blockType).toBe('hero');
    expect(blocks!.some((block) => block.blockType === 'footer' || block.blockType === 'lifestyle')).toBe(
      true,
    );
  });

  it('returns undefined for invalid image input without throwing', async () => {
    await expect(
      detectContentBlocksFromImage('https://example.invalid/no-image', { width: 100, height: 4000 }),
    ).resolves.toBeUndefined();
  });
});
