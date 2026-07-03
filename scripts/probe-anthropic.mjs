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
    process.env[k] = v;
  }
}

const key = process.env.ANTHROPIC_API_KEY?.trim();
console.log('ANTHROPIC_API_KEY:', key ? `${key.slice(0, 20)}... (len ${key.length})` : 'MISSING');
console.log('OCR_PROVIDER:', process.env.OCR_PROVIDER ?? '(unset → paddle if venv exists)');

if (!key) process.exit(1);

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 32,
    messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
  }),
});

const body = await res.text();
console.log('HTTP', res.status);
if (res.ok) {
  const data = JSON.parse(body);
  const text = data.content?.find((b) => b.type === 'text')?.text;
  console.log('Response:', text);
  console.log('SUCCESS — refresh Anthropic console Last used');
} else {
  console.log('Error body:', body.slice(0, 500));
}
