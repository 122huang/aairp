/**
 * One-off: Anthropic vision on user image → text review + visual checklist
 * Bypasses server PaddleOCR (broken venv) by calling Anthropic directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const imagePath =
  process.argv[2] ??
  path.join(
    root,
    '..',
    '.cursor',
    'projects',
    'c-Users-ShujieHuang-aairp',
    'assets',
    'c__Users_ShujieHuang_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_50H100-d8561942-3309-4d5b-96b6-542e0384ff42.png',
  );

const BASE = process.env.AAIRP_BASE ?? 'http://127.0.0.1:3000';

async function anthropicVision(prompt, imageBase64, mimeType) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  const model = process.env.OCR_VISION_LLM_MODEL?.trim() || 'claude-3-5-haiku-20241022';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? res.status);
  return data.content?.find((b) => b.type === 'text')?.text ?? '';
}

async function postReview(text) {
  const res = await fetch(`${BASE}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'sa.rice_cooker',
      content: { text },
      context: { product_sku: '40F560L' },
    }),
  });
  return res.json();
}

const buf = fs.readFileSync(imagePath);
const base64 = buf.toString('base64');
console.log('Image:', path.basename(imagePath), `(${(buf.length / 1024).toFixed(1)} KB)\n`);

const copyPrompt = `You are transcribing ad copy from a product detail image for legal review (Joyoung rice cooker, target market SG).
Output ONLY the visible marketing claims in reading order as plain text (English + any Chinese visible on product UI).
Do not summarize — list headlines, specs, comparisons, panel labels.`;

const visualPrompt = `You are an advertising visual compliance reviewer. Target market: Singapore (SG). Product: Joyoung rice cooker detail page.

Check ONLY these visual risks in the image:
1. market-asset-mismatch: overseas ad using domestic/CN product (e.g. Chinese on control panel, CN packaging)
2. production-artifact: uncleaned internal notes (draft, switch language, watermark)
3. certificate-issue: certificate/badge unreadable, wrong, or unverifiable

Output JSON only:
{
  "visual_findings": [
    { "type": "...", "severity": "HIGH|MEDIUM|LOW", "description": "...", "evidence": "what you see in image" }
  ],
  "summary": "one line"
}`;

console.log('--- 1) Anthropic vision: ad copy ---');
const t1 = Date.now();
const confirmedText = await anthropicVision(copyPrompt, base64, 'image/png');
console.log(`(${((Date.now() - t1) / 1000).toFixed(1)}s)\n`);
console.log(confirmedText.slice(0, 1500));
if (confirmedText.length > 1500) console.log('\n... [truncated]');

console.log('\n--- 2) demo/review on extracted copy ---');
const review = await postReview(confirmedText);
console.log('Decision:', review.final_decision);
console.log('Rationale:', review.rationale);
for (const f of review.summary?.findings ?? []) {
  if (f.decision === 'WARN' || f.decision === 'REJECT') {
    console.log(`  [${f.module}] ${f.ref_id}: ${f.summary}`);
  }
}

const cnInText = /[\u4e00-\u9fff]/.test(confirmedText);
console.log('\n确认文案含中文:', cnInText ? '是' : '否');

console.log('\n--- 3) Anthropic vision: visual compliance checklist ---');
const t2 = Date.now();
const visualRaw = await anthropicVision(visualPrompt, base64, 'image/png');
console.log(`(${((Date.now() - t2) / 1000).toFixed(1)}s)\n`);
console.log(visualRaw);
