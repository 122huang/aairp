/**
 * Verify 50H100.jpg compresses under 1.5MB data URL (mirrors review-ui canvas settings).
 * Usage: node scripts/verify-compress-50h100.mjs <path/to/50H100.jpg>
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(join(dirname(fileURLToPath(import.meta.url)), '../apps/api/node_modules/sharp'));

const MAX_LONG_EDGE = 1200;
const JPEG_QUALITY = 80;
const MAX_DATA_URL_LENGTH = Math.floor(1.5 * 1024 * 1024);

const imagePath = process.argv[2];
if (!imagePath || !existsSync(imagePath)) {
  console.error('Usage: node scripts/verify-compress-50h100.mjs <path/to/50H100.jpg>');
  process.exit(1);
}

const input = readFileSync(imagePath);
const meta = await sharp(input).metadata();
console.log('Input:', imagePath);
console.log(`  ${meta.width}x${meta.height}, ${(input.length / 1024).toFixed(1)} KB`);

let longEdge = MAX_LONG_EDGE;
let buffer = input;
let dataUrlLength = Infinity;

while (longEdge >= 320) {
  let quality = JPEG_QUALITY;
  while (quality >= 50) {
    buffer = await sharp(input)
      .rotate()
      .resize({
        width: meta.width >= meta.height ? longEdge : undefined,
        height: meta.height > meta.width ? longEdge : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    dataUrlLength = dataUrl.length;
    if (dataUrlLength <= MAX_DATA_URL_LENGTH) {
      console.log(`Output: ${longEdge}px long edge, quality ${quality / 100}`);
      console.log(
        `  JPEG ${(buffer.length / 1024).toFixed(1)} KB, data URL ${(dataUrlLength / 1024).toFixed(1)} KB`,
      );
      console.log('PASS: under 1.5MB data URL');
      process.exit(0);
    }
    quality -= 5;
  }
  longEdge = Math.round(longEdge * 0.85);
}

console.error('FAIL: could not compress below 1.5MB data URL');
process.exit(1);
