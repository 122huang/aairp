/**
 * End-to-end API test for long product detail image:
 * OCR status → smart-extract (browser OCR draft + vision LLM) → demo/review
 */
import fs from 'node:fs';

const BASE = process.env.AAIRP_BASE ?? 'http://127.0.0.1:3000';
const imagePath =
  process.argv[2] ??
  'C:\\Users\\ShujieHuang\\.cursor\\projects\\c-Users-ShujieHuang-aairp\\assets\\c__Users_ShujieHuang_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_50H100-eb52d110-b340-4380-a676-ddb529f3e75a.png';

function log(step, data) {
  console.log(`\n=== ${step} ===`);
  console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const err = new Error(`${res.status} ${url}`);
    err.response = json;
    err.status = res.status;
    throw err;
  }
  return json;
}

if (!fs.existsSync(imagePath)) {
  console.error('Image not found:', imagePath);
  process.exit(1);
}

const buf = fs.readFileSync(imagePath);
const base64 = buf.toString('base64');
const sizeKb = (buf.length / 1024).toFixed(1);
log('Image', { path: imagePath, sizeKb });

// Simulated noisy browser OCR draft (typical Tesseract output on long CN detail pages)
const ocrDraft = `
九阳 0涂层电压力锅
304不锈钢 更健康 0涂层
100kPa高压 1100W大功率
15分钟快煮饭 风冷降压
一锅双胆 15重安全保护
晶糯压力内胆
对比 普通涂层压力锅 70kPa 30-40分钟
容量4.0L 额定功率1100W 额定压力100kPa
`.trim();

try {
  const status = await fetch(`${BASE}/demo/ocr/status`).then((r) => r.json());
  log('OCR status', status);

  log('Smart extract', 'calling DeepSeek (may take 30-90s on long image)...');
  const t0 = Date.now();
  const smart = await postJson(`${BASE}/demo/ocr/smart-extract`, {
    image_base64: base64,
    mime_type: 'image/png',
    ocr_draft: ocrDraft,
    category_id: 'sa.rice_cooker',
  });
  log(`Smart extract OK (${((Date.now() - t0) / 1000).toFixed(1)}s)`, {
    ocr_provider: smart.ocr_provider,
    understand_provider: smart.understand_provider,
    image_width: smart.image_width,
    image_height: smart.image_height,
    confirmed_text_preview: (smart.confirmed_text ?? '').slice(0, 400),
    uncertain_count: smart.uncertain?.length ?? 0,
    structured_keys: smart.structured ? Object.keys(smart.structured) : [],
  });

  const adText = (smart.confirmed_text ?? ocrDraft).trim();
  if (!adText) throw new Error('No confirmed_text from smart extract');

  log('Review', 'submitting SG / sa.rice_cooker... (pressure cooker copy)...');
  const review = await postJson(`${BASE}/demo/review`, {
    external_ref: `e2e-long-image-${Date.now()}`,
    tenant_id: 'demo',
    country_id: 'SG',
    platform_id: 'META',
    category_id: 'sa.rice_cooker',
    content: {
      text: adText,
      images: [],
      landing_url: 'https://example.com/product',
    },
    context: { campaign_type: 'conversion', ad_format: 'image' },
    tags: ['e2e:long-image'],
  });

  log('Review result', {
    decision: review.decision?.outcome ?? review.decision,
    review_id: review.review_id,
    rule_hits: review.rule_results?.length ?? review.findings?.length,
    summary: review.summary ?? review.decision?.rationale?.slice?.(0, 200),
  });

  console.log('\n✅ Pipeline OK: smart-extract → review completed.');
} catch (e) {
  console.error('\n❌ Pipeline failed:', e.message);
  if (e.response) console.error(JSON.stringify(e.response, null, 2));
  process.exit(1);
}
