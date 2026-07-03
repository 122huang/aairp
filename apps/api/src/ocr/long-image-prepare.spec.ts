import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { prepareOcrImageTiles } from './long-image-prepare.js';

describe('prepareOcrImageTiles', () => {
  it('splits tall banner images into multiple jpeg tiles', async () => {
    const buffer = await sharp({
      create: {
        width: 750,
        height: 10000,
        channels: 3,
        background: { r: 245, g: 245, b: 245 },
      },
    })
      .png()
      .toBuffer();

    const prepared = await prepareOcrImageTiles(buffer, { allowUpscale: false });
    expect(prepared.width).toBe(750);
    expect(prepared.height).toBe(10000);
    expect(prepared.tiles.length).toBeGreaterThan(1);
    expect(prepared.tiles[0]?.mimeType).toBe('image/jpeg');
    expect(prepared.tiles[0]?.base64.length).toBeGreaterThan(100);
  });
});
