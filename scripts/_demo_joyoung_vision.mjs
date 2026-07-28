/**
 * One-shot demo: long-image vision pipeline on Joyoung PDP strip.
 * Usage: node scripts/_demo_joyoung_vision.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireFromApp = createRequire(join(root, 'packages/application/package.json'));
const sharp = requireFromApp('sharp');

function loadDotEnv(envPath) {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function importAppReview(moduleFile) {
  return import(
    pathToFileURL(join(root, 'packages/application/dist/review', moduleFile)).href
  );
}

loadDotEnv(join(root, '.env'));
// Prefer sibling aairp .env when running from a worktree (do not copy secrets).
loadDotEnv(join(root, '../aairp/.env'));
const outDir = join(root, 'tmp/joyoung-vision-demo');

async function main() {
  mkdirSync(outDir, { recursive: true });

  // CLI path > env > desktop original copy > chat-compressed fixture
  const candidates = [
    process.argv[2],
    process.env.JOYOUNG_IMG,
    join(root, 'benchmark/fixtures/image-compliance/raw/joyoung-50H100.jpg'),
    join(root, 'benchmark/fixtures/image-compliance/raw/joyoung-pressure-cooker-test.png'),
  ].filter(Boolean);
  const imgPath = candidates.find((p) => existsSync(p));
  if (!imgPath) {
    throw new Error(`Image not found. Tried:\n${candidates.join('\n')}`);
  }
  console.log('Using image:', imgPath);

  const meta = await sharp(imgPath).metadata();
  console.log('=== Source ===');
  console.log(`${meta.width}x${meta.height} ${meta.format} bytes=${meta.size}`);

  // Dynamic import built / ts via vitest path — use application dist if present else source via tsx-like
  const appEntry = join(root, 'packages/application/src/review/vision-compliance.service.ts');
  // Use relative imports through package by spawning vitest-less: compile with node --experimental
  // Instead import from relative .ts via jiti if available, else use built js

  let VisionComplianceService;
  let enhanceVisionSourceImages;
  let enhanceVisionSliceImage;
  let ImageSlicePlannerService;
  let detectContentBlocksFromImage;
  let FieldExtractService;
  let ConsistencyCompareService;

  try {
    const mod = await importAppReview('vision-compliance.service.js');
    VisionComplianceService = mod.VisionComplianceService;
    const prepMod = await importAppReview('vision-image-prepare.js');
    enhanceVisionSourceImages = prepMod.enhanceVisionSourceImages;
    enhanceVisionSliceImage = prepMod.enhanceVisionSliceImage;
    const plan = await importAppReview('image-slice-planner.service.js');
    ImageSlicePlannerService = plan.ImageSlicePlannerService;
    const seg = await importAppReview('image-section-segmenter.js');
    detectContentBlocksFromImage = seg.detectContentBlocksFromImage;
    await importAppReview('field-extract.service.js');
    await importAppReview('consistency-compare.service.js');
  } catch (e) {
    console.error('dist not built or import failed:', e.message);
    writeFileSync(join(outDir, 'note.txt'), 'Build packages/application first (pnpm --filter @aairp/application build)');
    console.log('Wrote', outDir);
    process.exit(1);
  }

  const buf = readFileSync(imgPath);
  const mime = meta.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  // 1) Preprocess
  const enhanced = await enhanceVisionSourceImages([dataUrl]);
  const prep = enhanced[0];
  console.log('\n=== Preprocess ===');
  console.log(JSON.stringify(prep ?? {}, null, 2));
  if (prep?.dataUrl?.startsWith('data:')) {
    const b64 = prep.dataUrl.split(',')[1];
    writeFileSync(join(outDir, 'enhanced.jpg'), Buffer.from(b64, 'base64'));
  }

  // 2) Segmentation + slice plan
  const workUrl = prep?.dataUrl ?? dataUrl;
  const workMeta = await sharp(
    Buffer.from(workUrl.split(',')[1], 'base64'),
  ).metadata();
  console.log(`\nWorking image: ${workMeta.width}x${workMeta.height}`);

  const blocks = (await detectContentBlocksFromImage(workUrl)) ?? [];
  console.log('\n=== Content blocks ===');
  console.log(`count=${blocks.length}`);
  console.log(
    blocks
      .slice(0, 12)
      .map(
        (b, i) =>
          `  [${i}] y=${b.yStart}-${b.yEnd} type=${b.sliceType ?? b.type ?? '?'}`,
      )
      .join('\n'),
  );

  const planner = new ImageSlicePlannerService();
  const manifests = planner.plan({
    imageUrls: [workUrl],
    dimensionsByImage: [{ width: workMeta.width, height: workMeta.height }],
    ...(blocks.length > 0 ? { contentBlockHintsByImage: [blocks] } : {}),
  });
  const manifest = manifests[0];
  console.log('\n=== Slice plan ===');
  console.log(`slices=${manifest.slices.length}`);
  for (const s of manifest.slices) {
    console.log(
      `  ${s.sliceId} type=${s.sliceType} y=${s.yStart}-${s.yEnd} h=${s.yEnd - s.yStart}`,
    );
  }

  // Save slice thumbs
  const { createSliceThumbnailDataUrl } = await importAppReview('image-slice-crop.js');
  for (const s of manifest.slices) {
    try {
      const thumb = await createSliceThumbnailDataUrl(workUrl, s);
      const b64 = thumb.split(',')[1];
      writeFileSync(join(outDir, `${s.sliceId}.jpg`), Buffer.from(b64, 'base64'));
    } catch (err) {
      console.warn('thumb fail', s.sliceId, err.message);
    }
  }

  // 3) Full vision discover (stub or live via env)
  const gatewayMod = await importAppReview('vision-llm.gateway.js');
  const mode = gatewayMod.resolveVisionLlmMode();
  console.log(`\n=== Vision discover (mode: ${mode}) ===`);

  const svc = new VisionComplianceService({
    // use defaults; live if env configured
  });

  const context = {
    reviewId: "demo-joyoung",
    dimensions: {
      countryId: "CN",
      platformId: "ecommerce",
      categoryId: "small-appliance",
    },
    normalizedContent: {
      text: "Joyoung PDP long image",
      imageUrls: [dataUrl],
    },
  };

  const t0 = Date.now();
  const result = await svc.discover(context);
  const ms = Date.now() - t0;

  console.log(`elapsed=${ms}ms`);
  const visionFindings = result.findings ?? [];
  const consistencyFindings = result.consistencyFindings ?? [];
  const resultManifest = result.manifests?.[0];
  console.log(`visionFindings=${visionFindings.length}`);
  console.log(`consistencyFindings=${consistencyFindings.length}`);
  console.log(`slices in result=${resultManifest?.slices?.length ?? 0}`);
  if (result.imagePreprocess) {
    console.log('imagePreprocess:', JSON.stringify(result.imagePreprocess, null, 2));
  }
  console.log('visionMode:', mode);

  for (const f of visionFindings) {
    console.log(
      `\n[VISION] ${f.severity} ${f.refId} slice=${f.sliceId}\n  ${f.summary}`,
    );
  }
  for (const f of consistencyFindings) {
    console.log(
      `\n[CONSIST] ${f.severity ?? ''} ${f.field ?? f.refId}\n  ${f.summary}`,
    );
  }

  writeFileSync(
    join(outDir, 'result.json'),
    JSON.stringify(
      {
        source: { path: imgPath, ...meta },
        preprocess: result.imagePreprocess,
        sliceCount: resultManifest?.slices?.length ?? manifest.slices.length,
        slices: resultManifest?.slices ?? manifest.slices,
        visionFindings,
        consistencyFindings,
        visionMode: mode,
        elapsedMs: ms,
      },
      null,
      2,
    ),
  );

  // Mini HTML report
  const thumbs = (resultManifest?.slices ?? manifest.slices ?? [])
    .map((s) => {
      const p = join(outDir, `${s.sliceId}.jpg`);
      if (!existsSync(p)) return '';
      return `<figure><img src="${s.sliceId}.jpg" alt="${s.sliceId}"/><figcaption>${s.sliceId} ${s.sliceType} y=${s.yStart}-${s.yEnd}</figcaption></figure>`;
    })
    .join('\n');

  const findingsHtml = visionFindings
    .map(
      (f) =>
        `<li><strong>${f.severity}</strong> ${f.refId} <em>${f.sliceId}</em><br/>${escapeHtml(f.summary)}</li>`,
    )
    .join('\n');

  writeFileSync(
    join(outDir, 'report.html'),
    `<!doctype html><html><meta charset="utf-8"/><title>Joyoung Vision Demo</title>
<style>
body{font-family:system-ui;max-width:900px;margin:24px auto;padding:0 16px;background:#111;color:#eee}
img{max-width:100%;border:1px solid #333}
figure{margin:16px 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
</style>
<h1>九阳长图 Vision 试跑</h1>
<p>Source: ${meta.width}×${meta.height} → preprocess applied. Mode: ${result.visionMode ?? mode}. ${ms}ms</p>
<h2>Preprocess</h2>
<pre>${escapeHtml(JSON.stringify(result.imagePreprocess ?? prep, null, 2))}</pre>
<p><img src="enhanced.jpg" alt="enhanced"/></p>
<h2>Slices (${resultManifest?.slices?.length ?? manifest.slices.length ?? 0})</h2>
<div class="grid">${thumbs}</div>
<h2>Vision Findings (${visionFindings.length})</h2>
<ul>${findingsHtml || '<li>none</li>'}</ul>
<h2>Consistency (${consistencyFindings.length})</h2>
<pre>${escapeHtml(JSON.stringify(consistencyFindings, null, 2))}</pre>
`,
  );

  console.log('\nWrote', outDir);
  console.log('Open:', join(outDir, 'report.html'));
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
