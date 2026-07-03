/**
 * Verify 50H100.jpg compresses to 500KB–2MB data URL (mirrors review-ui canvas settings).
 * Usage: node scripts/verify-compress-50h100.mjs <path/to/50H100.jpg>
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(join(dirname(fileURLToPath(import.meta.url)), '../apps/api/node_modules/sharp'));

const MAX_LONG_EDGE = 2000;
const MIN_SHORT_EDGE = 400;
const JPEG_QUALITY = 85;
const MAX_DATA_URL_LENGTH = Math.floor(3 * 1024 * 1024);
const MIN_TARGET_LENGTH = Math.floor(500 * 1024);
const MAX_TARGET_LENGTH = Math.floor(2 * 1024 * 1024);

function computeReviewImageDimensions(naturalWidth, naturalHeight) {
  const longEdge = Math.max(naturalWidth, naturalHeight);
  const shortEdge = Math.min(naturalWidth, naturalHeight);

  if (longEdge <= MAX_LONG_EDGE) {
    return { width: naturalWidth, height: naturalHeight };
  }

  const scaleByLong = MAX_LONG_EDGE / longEdge;
  if (shortEdge * scaleByLong >= MIN_SHORT_EDGE) {
    return {
      width: Math.max(1, Math.round(naturalWidth * scaleByLong)),
      height: Math.max(1, Math.round(naturalHeight * scaleByLong)),
    };
  }

  const scaleByShort = MIN_SHORT_EDGE / shortEdge;
  return {
    width: Math.max(1, Math.round(naturalWidth * scaleByShort)),
    height: Math.max(1, Math.round(naturalHeight * scaleByShort)),
  };
}

const imagePath = process.argv[2];
if (!imagePath || !existsSync(imagePath)) {
  console.error('Usage: node scripts/verify-compress-50h100.mjs <path/to/50H100.jpg>');
  process.exit(1);
}

const input = readFileSync(imagePath);
const meta = await sharp(input).metadata();
console.log('Input:', imagePath);
console.log(`  ${meta.width}x${meta.height}, ${(input.length / 1024).toFixed(1)} KB`);

const { width, height } = computeReviewImageDimensions(meta.width, meta.height);
const buffer = await sharp(input)
  .rotate()
  .resize(width, height)
  .flatten({ background: '#ffffff' })
  .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
  .toBuffer();

const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
const dataUrlLength = dataUrl.length;

console.log(`Output: ${width}x${height}, quality ${JPEG_QUALITY / 100}`);
console.log(
  `  JPEG ${(buffer.length / 1024).toFixed(1)} KB, data URL ${(dataUrlLength / 1024).toFixed(1)} KB`,
);

if (dataUrlLength > MAX_DATA_URL_LENGTH) {
  console.error('FAIL: exceeds 3MB data URL limit');
  process.exit(1);
}

if (dataUrlLength < MIN_TARGET_LENGTH || dataUrlLength > MAX_TARGET_LENGTH) {
  console.error(`FAIL: expected data URL between 500KB and 2MB, got ${(dataUrlLength / 1024).toFixed(1)} KB`);
  process.exit(1);
}

console.log('PASS: data URL in 500KB–2MB range and under 3MB limit');
process.exit(0);
