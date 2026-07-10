/**
 * Diagnose ImageSlicePlanner + crop sizes for compressed long image.
 * Usage: node scripts/diag-vision-slices.mjs [image-path]
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = require(join(root, 'apps/api/node_modules/sharp'));

const { ImageSlicePlannerService } = await import(
  pathToFileURL(join(root, 'packages/application/dist/review/image-slice-planner.service.js')).href
);
const { cropImageDataUrlForSlice, probeImageDimensions } = await import(
  pathToFileURL(join(root, 'packages/application/dist/review/image-slice-crop.js')).href
);

const MIN_SHORT = 400;
const MAX_LONG = 2000;
const JPEG_QUALITY = 85;

async function compressLikeReviewApp(input) {
  const meta = await sharp(input).metadata();
  const longEdge = Math.max(meta.width, meta.height);
  const shortEdge = Math.min(meta.width, meta.height);
  let scale = longEdge <= MAX_LONG ? 1 : MAX_LONG / longEdge;
  if (shortEdge * scale < MIN_SHORT) {
    scale = MIN_SHORT / shortEdge;
  }
  const width = Math.max(1, Math.round(meta.width * scale));
  const height = Math.max(1, Math.round(meta.height * scale));
  const buffer = await sharp(input)
    .resize(width, height)
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return {
    buffer,
    dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}`,
    width,
    height,
  };
}

const imagePath = process.argv[2];
if (!imagePath || !existsSync(imagePath)) {
  console.error('Usage: node scripts/diag-vision-slices.mjs <image-path>');
  process.exit(1);
}

const input = readFileSync(imagePath);
const compressed = await compressLikeReviewApp(input);
const probed = await probeImageDimensions(compressed.dataUrl);

const planner = new ImageSlicePlannerService();
const manifests = planner.plan({
  imageUrls: [compressed.dataUrl],
  dimensionsByImage: [probed],
});
const manifest = manifests[0];

console.log('Compressed upload:', `${probed.width}x${probed.height}`, `(${(compressed.buffer.length / 1024).toFixed(1)} KB jpeg)`);
console.log('Planner called: yes (simulated VisionComplianceService.discover path)');
console.log('Planner mode:', manifest.plannerMode, manifest.fallbackReason ?? '');
console.log('Slice count:', manifest.slices.length);
console.log('');

for (const slice of manifest.slices) {
  const croppedUrl = await cropImageDataUrlForSlice(compressed.dataUrl, slice);
  const dim = await probeImageDimensions(croppedUrl);
  const yStartPx = Math.round(slice.yStart * probed.height);
  const yEndPx = Math.round(slice.yEnd * probed.height);
  console.log(
    `slice ${slice.sliceIndex}: y ${yStartPx}-${yEndPx}px (${slice.yStart.toFixed(4)}-${slice.yEnd.toFixed(4)}) -> ${dim.width}x${dim.height}, dataUrl ${(croppedUrl.length / 1024).toFixed(1)} KB`,
  );
}
