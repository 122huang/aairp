import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { enhanceVisionSourceImage } from './vision-image-prepare.js';

async function makeNarrowLongJpeg(width: number, height: number): Promise<string> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 40, b: 50 },
    },
  })
    .jpeg({ quality: 60 })
    .toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

describe('enhanceVisionSourceImage', () => {
  it('strongly upscales chat-compressed narrow long images within height budget', async () => {
    const source = await makeNarrowLongJpeg(42, 1024);
    const enhanced = await enhanceVisionSourceImage(source);

    expect(enhanced).toBeDefined();
    expect(enhanced!.upscaled).toBe(true);
    expect(enhanced!.sharpened).toBe(true);
    expect(enhanced!.sourceWidth).toBe(42);
    expect(enhanced!.width).toBeGreaterThan(42);
    expect(enhanced!.width).toBeLessThanOrEqual(2400);
    expect(enhanced!.height).toBeLessThanOrEqual(18_000);
    expect(enhanced!.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
  }, 15_000);

  it('mildly upscales mid-width images below 2400', async () => {
    const source = await makeNarrowLongJpeg(800, 2400);
    const enhanced = await enhanceVisionSourceImage(source);

    expect(enhanced).toBeDefined();
    expect(enhanced!.upscaled).toBe(true);
    expect(enhanced!.width).toBe(Math.min(2400, Math.round(800 * 1.75)));
  }, 15_000);

  it('downscales overly wide images to maxWidth without marking upscaled', async () => {
    const source = await makeNarrowLongJpeg(3200, 4000);
    const enhanced = await enhanceVisionSourceImage(source, { maxWidth: 2400 });

    expect(enhanced).toBeDefined();
    expect(enhanced!.upscaled).toBe(false);
    expect(enhanced!.width).toBe(2400);
  }, 15_000);

  it('enhances a narrow slice crop for LLM readability', async () => {
    const { enhanceVisionSliceImage } = await import('./vision-image-prepare.js');
    const source = await makeNarrowLongJpeg(80, 900);
    const enhancedUrl = await enhanceVisionSliceImage(source);
    const enhanced = await enhanceVisionSourceImage(enhancedUrl, { sharpen: false });
    expect(enhancedUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(enhanced!.width).toBeGreaterThanOrEqual(80);
  }, 15_000);
});
