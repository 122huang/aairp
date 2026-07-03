import fs from 'node:fs';

const BASE = process.env.AAIRP_BASE ?? 'http://127.0.0.1:3000';
const imagePath =
  process.argv[2] ??
  'C:\\Users\\ShujieHuang\\.cursor\\projects\\c-Users-ShujieHuang-aairp\\assets\\c__Users_ShujieHuang_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_50H100-d8561942-3309-4d5b-96b6-542e0384ff42.png';

const ocrDraft = `
Joyoung Smart IH Rice Cooker
4.0L 1200W 24h Smart Preset
Smarter Faster Better
IH High Power Electromagnetic Induction Heating
Daikin Non-stick Coating
15 Layers of Safety Protection
SMART TOUCH CONTROL PANEL
Rice Quick Rice Congee
What's Included
`.trim();

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json = JSON.parse(text);
  if (!res.ok) throw new Error(`${res.status} ${json.detail ?? text.slice(0, 300)}`);
  return json;
}

const buf = fs.readFileSync(imagePath);
const base64 = buf.toString('base64');
console.log('Image KB:', (buf.length / 1024).toFixed(1));

const status = await fetch(`${BASE}/demo/ocr/status`).then((r) => r.json());
console.log('Vision LLM:', status.capabilities?.vision_llm_provider);

console.log('\n--- Smart extract (anthropic vision) ---');
const t0 = Date.now();
const smart = await postJson(`${BASE}/demo/ocr/smart-extract`, {
  image_base64: base64,
  mime_type: 'image/png',
  ocr_draft: ocrDraft,
  category_id: 'sa.rice_cooker',
});
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log('understand_provider:', smart.understand_provider);
console.log('confirmed_text length:', (smart.confirmed_text ?? '').length);
console.log('\n--- confirmed_text (first 1200 chars) ---\n');
console.log((smart.confirmed_text ?? '').slice(0, 1200));
if (smart.notes?.length) console.log('\nnotes:', smart.notes);
if (smart.uncertain?.length) {
  console.log('\nuncertain:', smart.uncertain.slice(0, 5));
}

const text = smart.confirmed_text ?? ocrDraft;
console.log('\n--- demo/review (SG rice_cooker) ---');
const review = await postJson(`${BASE}/demo/review`, {
  country_id: 'SG',
  platform_id: 'META',
  category_id: 'sa.rice_cooker',
  content: { text, ocr_text: ocrDraft },
  context: { product_sku: '40F560L' },
});
console.log('Decision:', review.final_decision);
console.log('Rationale:', review.rationale);
const findings = (review.summary?.findings ?? []).filter(
  (f) => f.decision === 'WARN' || f.decision === 'REJECT',
);
for (const f of findings) {
  console.log(`  [${f.module}] ${f.ref_id}: ${f.summary}`);
}

const localizationHits = [
  'chinese',
  '精华饭',
  '预约',
  '国内',
  'bilingual',
  'switch to',
].filter((k) => text.toLowerCase().includes(k.toLowerCase()));
console.log('\n--- 视觉/本地化线索是否在确认文案中 ---');
console.log(localizationHits.length ? localizationHits.join(', ') : '(未在文案中出现中文面板/本地化关键词)');
