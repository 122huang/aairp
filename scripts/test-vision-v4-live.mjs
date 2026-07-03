/**
 * One-off: test DeepSeek V4 vision live call (reads .env from repo root).
 * Usage: node scripts/test-vision-v4-live.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  try {
    const raw = readFileSync(join(root, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
  }
}

loadEnv();

const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
if (!apiKey) {
  console.error('DEEPSEEK_API_KEY not set in .env');
  process.exit(1);
}

const baseUrl = (process.env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com').replace(
  /\/$/,
  '',
);
const model = process.env.VISION_LLM_MODEL?.trim() || 'deepseek-v4-flash';

// Minimal valid 1x1 JPEG (no external fetch)
const minimalJpegBase64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
const dataUrl = `data:image/jpeg;base64,${minimalJpegBase64}`;

const promptTemplate = readFileSync(join(root, 'demo/vision.prompt.txt'), 'utf8');
const prompt = promptTemplate
  .replaceAll('{country_id}', 'SG')
  .replaceAll('{platform_id}', 'META')
  .replaceAll('{category_id}', 'sa.air_fryer')
  .replaceAll('{source_image_index}', '0')
  .replaceAll('{slice_index}', '0')
  .replaceAll('{slice_type}', 'full')
  .replaceAll('{slice_y_start}', '0')
  .replaceAll('{slice_y_end}', '1')
  .replaceAll('{ad_text}', 'Healthy air frying made easy')
  .replaceAll('{ocr_text}', '')
  .replaceAll('{image_url}', 'inline-base64');

console.log(`Calling ${baseUrl}/v1/chat/completions model=${model} ...`);

const response = await fetch(`${baseUrl}/v1/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model,
    max_tokens: 2048,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  }),
});

const bodyText = await response.text();
if (!response.ok) {
  console.error('API error', response.status, bodyText.slice(0, 800));
  process.exit(1);
}

const data = JSON.parse(bodyText);
const content = data.choices?.[0]?.message?.content;
console.log('Status: OK');
console.log('--- response (first 2000 chars) ---');
console.log(typeof content === 'string' ? content.slice(0, 2000) : content);

try {
  const parsed = JSON.parse(content);
  console.log('--- parsed JSON keys ---', Object.keys(parsed));
  if (Array.isArray(parsed.findings)) {
    console.log('findings count:', parsed.findings.length);
  }
} catch (e) {
  console.log('Response is not valid JSON:', e.message);
}
