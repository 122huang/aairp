/**
 * 本地原图 OCR → DeepSeek 整理 → 可选合规审查
 *
 * 用法：
 *   node scripts/ocr-local-file.mjs "C:\path\to\detail.png"
 *   node scripts/ocr-local-file.mjs "C:\path\to\detail.jpg" --category sa.rice_cooker --country SG
 *   node scripts/ocr-local-file.mjs "C:\path\to\detail.png" --review
 *
 * 前提：API 已启动（start-legal-pilot.ps1）
 * 最佳效果：.env 中配置 GOOGLE_VISION_API_KEY（服务端 Google OCR + sharp 分片放大）
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AAIRP_BASE ?? 'http://127.0.0.1:3000';

function parseArgs(argv) {
  const positional = [];
  let category = 'sa.rice_cooker';
  let country = 'SG';
  let review = false;
  let outFile = null;

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--review') review = true;
    else if (a === '--category' && argv[i + 1]) category = argv[++i];
    else if (a === '--country' && argv[i + 1]) country = argv[++i];
    else if (a === '--out' && argv[i + 1]) outFile = argv[++i];
    else if (!a.startsWith('--')) positional.push(a);
  }

  return { imagePath: positional[0], category, country, review, outFile };
}

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
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
    json = { raw: text.slice(0, 800) };
  }
  if (!res.ok) {
    const err = new Error(`${res.status} ${url}`);
    err.response = json;
    throw err;
  }
  return json;
}

const { imagePath, category, country, review, outFile } = parseArgs(process.argv);

if (!imagePath) {
  console.error(`用法: node scripts/ocr-local-file.mjs "<图片路径>" [--category sa.rice_cooker] [--country SG] [--review] [--out result.txt]

说明:
  · 读取本地原图字节（不经浏览器 JPEG 压缩）
  · 若已配置 GOOGLE_VISION_API_KEY → 服务端 Google OCR（推荐）
  · 否则无法自动抓字，需手动粘贴 OCR 草稿或配置 Google Key
`);
  process.exit(1);
}

const resolved = path.resolve(imagePath);
if (!fs.existsSync(resolved)) {
  console.error('文件不存在:', resolved);
  process.exit(1);
}

const buf = fs.readFileSync(resolved);
const base64 = buf.toString('base64');
const mime = mimeFromExt(resolved);
const sizeKb = (buf.length / 1024).toFixed(1);

console.log('本地原图:', resolved);
console.log('大小:', `${sizeKb} KB`, '· MIME:', mime);
console.log('API:', BASE);

try {
  const status = await fetch(`${BASE}/demo/ocr/status`).then((r) => r.json());
  console.log('\nOCR 能力:', JSON.stringify(status.capabilities, null, 2));

  let ocrDraft = '';
  let ocrMeta = null;

  if (status.capabilities?.google_ocr) {
    console.log('\n[1/3] Google Vision OCR（服务端 sharp 放大 + 长图分片）…');
    const t0 = Date.now();
    ocrMeta = await postJson(`${BASE}/demo/ocr/extract`, {
      image_base64: base64,
      mime_type: mime,
    });
    ocrDraft = (ocrMeta.ocr_text ?? '').trim();
    console.log(
      `  完成 ${((Date.now() - t0) / 1000).toFixed(1)}s · ${ocrMeta.provider} · ${ocrMeta.tile_count} 段 · ${ocrMeta.image_width}×${ocrMeta.image_height}px`,
    );
    console.log('  预览:', ocrDraft.slice(0, 200).replace(/\n/g, ' ') + (ocrDraft.length > 200 ? '…' : ''));
  } else {
    console.log('\n[1/3] 跳过 Google OCR（未配置 GOOGLE_VISION_API_KEY）');
    console.log('  → 浏览器 Tesseract 对电商长图效果差；请配置 Google Key 或手动粘贴文案到 --ocr-draft');
    const draftArg = process.argv.indexOf('--ocr-draft');
    if (draftArg >= 0 && process.argv[draftArg + 1]) {
      ocrDraft = process.argv[draftArg + 1].trim();
      console.log('  使用 --ocr-draft 参数');
    } else {
      console.error('\n无法继续：无 Google OCR 且无 --ocr-draft。');
      console.error('请在 .env 添加 GOOGLE_VISION_API_KEY 后重启 API。');
      process.exit(1);
    }
  }

  if (!ocrDraft) {
    console.error('OCR 未识别到文字');
    process.exit(1);
  }

  console.log('\n[2/3] DeepSeek / LLM 整理…');
  const t1 = Date.now();
  const smart = await postJson(`${BASE}/demo/ocr/smart-extract`, {
    image_base64: base64,
    mime_type: mime,
    ocr_draft: ocrDraft,
    category_id: category,
  });
  const confirmed = (smart.confirmed_text ?? ocrDraft).trim();
  console.log(
    `  完成 ${((Date.now() - t1) / 1000).toFixed(1)}s · ${smart.understand_provider ?? 'unknown'}`,
  );
  console.log('\n--- 确认文案 ---\n');
  console.log(confirmed);

  if (smart.structured) {
    console.log('\n--- 结构化 ---');
    for (const [key, val] of Object.entries(smart.structured)) {
      if (Array.isArray(val) && val.length) {
        console.log(`${key}:`, val.join(' | '));
      }
    }
  }

  if (outFile) {
    fs.writeFileSync(outFile, confirmed, 'utf8');
    console.log('\n已写入:', path.resolve(outFile));
  }

  if (review) {
    console.log(`\n[3/3] 合规审查 ${country} / ${category}…`);
    const result = await postJson(`${BASE}/demo/review`, {
      external_ref: `local-ocr-${Date.now()}`,
      tenant_id: 'demo',
      country_id: country,
      platform_id: 'META',
      category_id: category,
      content: { text: confirmed, images: [], landing_url: 'https://example.com/product' },
      context: { campaign_type: 'conversion', ad_format: 'image' },
      tags: ['local-file-ocr'],
    });
    console.log('决策:', result.final_decision ?? result.summary?.final_decision);
    console.log('review_id:', result.review_id);
  }

  console.log('\n✅ 完成。请对照原图核对上方文案后再用于正式审查。');
} catch (e) {
  console.error('\n❌ 失败:', e.message);
  if (e.response) console.error(JSON.stringify(e.response, null, 2));
  process.exit(1);
}
