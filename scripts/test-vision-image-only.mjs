/**
 * Smoke test: vision prompt with empty ad text (image-only submission).
 * Usage: node scripts/test-vision-image-only.mjs <image-path> [country_id]
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function resolveVisionAdTextReference(countryId, adText) {
  const trimmed = adText?.trim() ?? '';
  if (trimmed) return trimmed;
  return `Target market is ${countryId}. The primary language should be the local language or English. Flag any non-English, non-local-language text visible on product panels or UI elements.`;
}

loadEnv();

const imagePath = process.argv[2];
const countryId = (process.argv[3] ?? 'SG').toUpperCase();
if (!imagePath || !existsSync(imagePath)) {
  console.error('Usage: node scripts/test-vision-image-only.mjs <image-path> [country_id]');
  process.exit(1);
}

const apiKey = process.env.VISION_LLM_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim();
if (!apiKey) {
  console.error('Set VISION_LLM_API_KEY or DEEPSEEK_API_KEY for live test');
  process.exit(1);
}

const ext = extname(imagePath).toLowerCase();
const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
const buf = readFileSync(imagePath);
const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

const baseUrl = (
  process.env.VISION_LLM_BASE_URL?.trim() || 'https://api.siliconflow.cn/v1'
).replace(/\/$/, '');
const model = process.env.VISION_LLM_MODEL?.trim() || 'Qwen/Qwen3-VL-8B-Instruct';
const chatUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

const promptTemplate = readFileSync(join(root, 'demo/vision.prompt.txt'), 'utf8');
const adTextRef = resolveVisionAdTextReference(countryId, '');
const prompt =
  '/no_think\n' +
  promptTemplate
    .replaceAll('{country_id}', countryId)
    .replaceAll('{platform_id}', 'META')
    .replaceAll('{category_id}', 'sa.rice_cooker')
    .replaceAll('{source_image_index}', '0')
    .replaceAll('{slice_index}', '0')
    .replaceAll('{slice_type}', 'full')
    .replaceAll('{slice_y_start}', '0')
    .replaceAll('{slice_y_end}', '1')
    .replaceAll('{ad_text}', adTextRef)
    .replaceAll('{ocr_text}', '')
    .replaceAll('{image_url}', 'inline-base64');

console.log('Image-only vision test');
console.log('Image:', imagePath, `(${(buf.length / 1024).toFixed(1)} KB)`);
console.log('Country:', countryId);
console.log('Ad text ref:', adTextRef);
console.log('Calling', model, '...\n');

const started = Date.now();
const response = await fetch(chatUrl, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model,
    max_tokens: 4096,
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

const data = await response.json();
console.log('HTTP', response.status, 'in', ((Date.now() - started) / 1000).toFixed(1) + 's');
if (!response.ok) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

const content = data.choices?.[0]?.message?.content ?? '';
console.log(content);

let parsed;
try {
  const jsonStart = content.indexOf('{');
  const jsonEnd = content.lastIndexOf('}');
  parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
} catch {
  console.error('\nFAIL: could not parse JSON from model response');
  process.exit(1);
}

const findings = parsed.findings ?? [];
const panelFindings = findings.filter((f) => f.scan_dimension === 'panel_language');
console.log('\nFindings:', findings.length, '| panel_language:', panelFindings.length);
if (findings.length === 0) {
  console.error('FAIL: expected at least one vision finding for image-only submission');
  process.exit(1);
}
console.log('PASS');
