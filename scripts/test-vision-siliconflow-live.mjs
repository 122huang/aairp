/**
 * Live smoke test: SiliconFlow DeepSeek-VL2 on a local ad image.
 * Usage: node scripts/test-vision-siliconflow-live.mjs [path/to/50H100.jpg]
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

loadEnv();

const arg = process.argv[2];
if (!arg) {
  console.error('Usage:');
  console.error('  node scripts/test-vision-siliconflow-live.mjs <image-path>');
  console.error('  node scripts/test-vision-siliconflow-live.mjs --data-url "data:image/jpeg;base64,..."');
  process.exit(1);
}

let dataUrl;
let label;
if (arg === '--data-url') {
  dataUrl = process.argv[3]?.trim();
  if (!dataUrl?.startsWith('data:image/')) {
    console.error('Pass a full data URL: data:image/jpeg;base64,... or data:image/png;base64,...');
    process.exit(1);
  }
  label = 'inline data URL';
} else if (existsSync(arg)) {
  const ext = extname(arg).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const buf = readFileSync(arg);
  dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
  label = `${arg} (${(buf.length / 1024).toFixed(1)} KB)`;
} else {
  console.error('File not found:', arg);
  console.error('Supported file types: .jpg, .jpeg, .png, .webp');
  console.error('Or pass --data-url "data:image/jpeg;base64,..."');
  process.exit(1);
}

const apiKey = process.env.VISION_LLM_API_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim();
if (!apiKey) {
  console.error('Set VISION_LLM_API_KEY or DEEPSEEK_API_KEY');
  process.exit(1);
}

const baseUrl = (
  process.env.VISION_LLM_BASE_URL?.trim() || 'https://api.siliconflow.cn/v1'
).replace(/\/$/, '');
const model = process.env.VISION_LLM_MODEL?.trim() || 'Qwen/Qwen3.6-35B-A3B';
const chatUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

const promptTemplate = readFileSync(join(root, 'demo/vision.prompt.txt'), 'utf8');
const prompt = '/no_think\n' + promptTemplate
  .replaceAll('{country_id}', 'TH')
  .replaceAll('{platform_id}', 'META')
  .replaceAll('{category_id}', 'sa.rice_cooker')
  .replaceAll('{source_image_index}', '0')
  .replaceAll('{slice_index}', '0')
  .replaceAll('{slice_type}', 'full')
  .replaceAll('{slice_y_start}', '0')
  .replaceAll('{slice_y_end}', '1')
  .replaceAll('{ad_text}', 'Perfect results every single time')
  .replaceAll('{ocr_text}', '')
  .replaceAll('{image_url}', 'inline-base64');

console.log('Image:', label);
console.log('Endpoint:', chatUrl);
console.log('Model:', model);
console.log('Calling SiliconFlow...\n');

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
    enable_thinking: false,
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
console.log(`HTTP ${response.status} (${((Date.now() - started) / 1000).toFixed(1)}s)\n`);

if (!response.ok) {
  console.error(bodyText.slice(0, 1200));
  process.exit(1);
}

const data = JSON.parse(bodyText);
const content = data.choices?.[0]?.message?.content ?? '';
console.log('--- raw response (first 3000 chars) ---');
console.log(content.slice(0, 3000));

let parsed;
try {
  parsed = JSON.parse(content);
} catch {
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch?.[1]?.trim() ?? content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1);
  parsed = JSON.parse(candidate);
}

console.log('\n--- parsed ---');
console.log('extracted_text sample:', (parsed.extracted_text ?? []).slice(0, 15));
console.log('findings count:', parsed.findings?.length ?? 0);
for (const f of parsed.findings ?? []) {
  console.log(`  - ${f.risk_type} | ${f.severity} | ${f.description?.slice(0, 80)}`);
}

const extracted = JSON.stringify(parsed.extracted_text ?? []).toLowerCase();
const findingsText = JSON.stringify(parsed.findings ?? []).toLowerCase();
const hits = ['perfect', 'every time', 'every single time'].filter(
  (term) => extracted.includes(term) || findingsText.includes(term),
);
console.log('\nRisk keyword hits:', hits.length ? hits.join(', ') : 'none detected');
