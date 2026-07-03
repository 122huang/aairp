/**
 * Live test: one Vision LLM API call per cropped slice (50H100 long image).
 * Usage: node scripts/test-vision-slices-live.mjs [path/to/50H100.jpg] [country_id]
 */
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

loadEnv();

const require = createRequire(import.meta.url);
const sharp = require(join(root, 'apps/api/node_modules/sharp'));

const { ImageSlicePlannerService } = await import(
  pathToFileURL(join(root, 'packages/application/dist/review/image-slice-planner.service.js')).href
);
const { cropImageDataUrlForSlice, probeImageDimensions } = await import(
  pathToFileURL(join(root, 'packages/application/dist/review/image-slice-crop.js')).href
);
const { renderVisionPrompt, estimateVisionInputTokens, resolveVisionAdTextReference } =
  await import(
    pathToFileURL(join(root, 'packages/application/dist/review/vision-compliance.service.js')).href
  );

const MIN_SHORT = 400;
const MAX_LONG = 2000;
const JPEG_QUALITY = 85;
const MAX_SEQ_LEN = 262_144;

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
const countryId = (process.argv[3] ?? 'SG').toUpperCase();
if (!imagePath || !existsSync(imagePath)) {
  console.error('Usage: node scripts/test-vision-slices-live.mjs <image-path> [country_id]');
  process.exit(1);
}

const apiKey = process.env.VISION_LLM_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim();
if (!apiKey) {
  console.error('Set VISION_LLM_API_KEY');
  process.exit(1);
}

const baseUrl = (
  process.env.VISION_LLM_BASE_URL?.trim() || 'https://api.siliconflow.cn/v1'
).replace(/\/$/, '');
const model = process.env.VISION_LLM_MODEL?.trim() || 'Qwen/Qwen3-VL-8B-Instruct';
const chatUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
const promptTemplate = readFileSync(join(root, 'demo/vision.prompt.txt'), 'utf8');

const input = readFileSync(imagePath);
const compressed = await compressLikeReviewApp(input);
const probed = await probeImageDimensions(compressed.dataUrl);

const context = {
  dimensions: { countryId, platformId: 'META', categoryId: 'sa.rice_cooker' },
  normalizedContent: {
    text: '',
    imageUrls: [compressed.dataUrl],
    ocrText: '',
  },
};

const planner = new ImageSlicePlannerService();
const manifest = planner.plan({
  imageUrls: [compressed.dataUrl],
  dimensionsByImage: [probed],
})[0];

console.log('Compressed:', `${probed.width}x${probed.height}`, 'slices:', manifest.slices.length);
console.log('Model:', model);
console.log('');

let callCount = 0;
for (const slice of manifest.slices) {
  const croppedUrl = await cropImageDataUrlForSlice(compressed.dataUrl, slice);
  const croppedDim = await probeImageDimensions(croppedUrl);
  const prompt = '/no_think\n' + renderVisionPrompt(promptTemplate, context, slice);
  const tokensEstimate = estimateVisionInputTokens(prompt, croppedUrl);

  console.log(
    `vision slice call: sliceIndex=${slice.sliceIndex}, size=${croppedDim?.width}x${croppedDim?.height}, tokensEstimate=${tokensEstimate}`,
  );

  if (tokensEstimate >= MAX_SEQ_LEN) {
    console.error('FAIL: estimate exceeds max_seq_len before API call');
    process.exit(1);
  }

  if (!prompt.includes('attached-inline-slice')) {
    console.error('FAIL: prompt still embeds full image reference');
    process.exit(1);
  }

  const started = Date.now();
  const response = await fetch(chatUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: croppedUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  const data = await response.json();
  callCount += 1;

  if (!response.ok) {
    console.error('HTTP', response.status, JSON.stringify(data).slice(0, 500));
    process.exit(1);
  }

  const tokensActual = data.usage?.total_tokens;
  console.log(
    `  -> HTTP ${response.status} in ${((Date.now() - started) / 1000).toFixed(1)}s, tokensActual=${tokensActual ?? 'n/a'}`,
  );

  if (tokensActual !== undefined && tokensActual >= MAX_SEQ_LEN) {
    console.error('FAIL: actual tokens exceed max_seq_len');
    process.exit(1);
  }
}

console.log(`\nPASS: ${callCount} separate API calls, all under ${MAX_SEQ_LEN} tokens`);
