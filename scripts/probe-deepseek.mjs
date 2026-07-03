import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(root, '.env'))) {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[k] = v;
  }
}

const key = process.env.DEEPSEEK_API_KEY?.trim();
if (!key) {
  console.log('DEEPSEEK_API_KEY: missing');
  process.exit(1);
}

const base = (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').replace(/\/$/, '');
const res = await fetch(`${base}/v1/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: process.env.OCR_LLM_MODEL?.trim() || 'deepseek-chat',
    max_tokens: 16,
    messages: [{ role: 'user', content: 'Reply ok only' }],
  }),
});
const body = await res.text();
console.log('DeepSeek text HTTP', res.status);
console.log(body.slice(0, 400));
