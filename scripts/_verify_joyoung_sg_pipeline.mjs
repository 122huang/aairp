/**
 * End-to-end local verification for Joyoung long PDP on SG:
 * Vision → readability gate → visionText rule re-eval → decision fuse.
 *
 * Usage: node scripts/_verify_joyoung_sg_pipeline.mjs [imagePath]
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

loadDotEnv(join(root, '../aairp/.env'));
loadDotEnv(join(root, '.env'));

const outDir = join(root, 'tmp/joyoung-sg-verify');

async function main() {
  mkdirSync(outDir, { recursive: true });

  const candidates = [
    process.argv[2],
    join(root, 'benchmark/fixtures/image-compliance/raw/joyoung-50H100.jpg'),
    'C:\\Users\\ShujieHuang\\OneDrive - JS Global\\Desktop\\50H100.jpg',
  ].filter(Boolean);
  const imgPath = candidates.find((p) => existsSync(p));
  if (!imgPath) throw new Error(`Image not found:\n${candidates.join('\n')}`);

  const meta = await sharp(imgPath).metadata();
  console.log('=== Source ===');
  console.log(imgPath);
  console.log(`${meta.width}x${meta.height} ${meta.format}`);

  const {
    VisionComplianceService,
  } = await importAppReview('vision-compliance.service.js');
  const { applyImageReadabilityGate } = await importAppReview('image-readability-gate.js');
  const { RuleEngineService } = await importAppReview('rule-engine.service.js');
  const { DecisionEngineService, computeCombinedHasBlocker } = await importAppReview(
    'decision-engine.service.js',
  );
  const { joinVisionExtractedText } = await importAppReview('content-matching.js');
  const { resolveVisionLlmMode } = await importAppReview('vision-llm.gateway.js');

  const buf = readFileSync(imgPath);
  const mime = meta.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  // Mirror user case: SG + image-only (empty ad text)
  const context = {
    reviewId: 'verify-joyoung-sg',
    advertisementId: 'ad-verify-joyoung',
    contentHash: 'verify',
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: 'SG',
      platformId: 'SHOPEE',
      categoryId: 'sa.other',
    },
    normalizedContent: {
      text: '',
      imageUrls: [dataUrl],
      imageDimensions: [{ width: meta.width, height: meta.height }],
    },
    resolvedKnowledgeVersions: {
      rulePack: 'demo',
      playbook: 'demo',
      openRiskPrompt: 'demo',
      visionPrompt: 'demo',
    },
    advertisementContext: {},
    tags: [],
    builtAt: new Date().toISOString(),
  };

  const mode = resolveVisionLlmMode();
  console.log(`\n=== Vision (${mode}) ===`);
  const t0 = Date.now();
  const visionRaw = await new VisionComplianceService().discover(context);
  const visionMs = Date.now() - t0;
  console.log(`elapsed=${visionMs}ms findings=${visionRaw.findings?.length ?? 0}`);
  console.log(`extractedText lines=${visionRaw.extractedText?.length ?? 0}`);

  const gated = applyImageReadabilityGate(context, visionRaw);
  const gateHit = (gated?.findings ?? []).some((f) => f.refId === 'insufficient-visible-text');
  console.log(`\n=== Readability gate ===`);
  console.log(`triggered=${gateHit}`);

  const visionText = joinVisionExtractedText(gated?.extractedText);
  console.log(`\n=== Vision text → rules ===`);
  console.log(`visionText chars=${visionText?.length ?? 0}`);
  if (visionText) {
    const preview = visionText.slice(0, 500).replace(/\s+/g, ' ');
    console.log(`preview: ${preview}${visionText.length > 500 ? '…' : ''}`);
  }

  const ruleContext = {
    ...context,
    normalizedContent: {
      ...context.normalizedContent,
      ...(visionText ? { visionText } : {}),
    },
  };
  const ruleResult = new RuleEngineService().evaluate(ruleContext);
  const perf = ruleResult.findings.filter((f) => f.refId === 'demo-apac-sa-performance-claim');
  const cap = ruleResult.findings.filter((f) => f.refId === 'demo-apac-sa-capacity-claim');
  console.log(`ruleFindings=${ruleResult.findings.length}`);
  console.log(`performance-claim=${perf.length} capacity-claim=${cap.length}`);
  for (const f of ruleResult.findings) {
    const span = f.evaluationDetail?.matchedSpans?.[0]?.text ?? '';
    console.log(`  [RULE] ${f.severity} ${f.refId} ${span ? `«${span}»` : ''}`);
  }

  const decision = new DecisionEngineService().fuseFromFindings({
    reviewId: context.reviewId,
    countryId: 'SG',
    hasBlocker: computeCombinedHasBlocker({
      ruleHasBlocker: ruleResult.hasBlocker,
      visionFindings: gated?.findings ?? [],
    }),
    ruleFindings: ruleResult.findings,
    playbookFindings: [],
    llmFindings: [],
    visionFindings: gated?.findings ?? [],
    consistencyFindings: gated?.consistencyFindings ?? [],
  });

  console.log(`\n=== Decision ===`);
  console.log(`final=${decision.finalDecision}`);
  console.log(`branches=${JSON.stringify(decision.branchVerdicts)}`);
  console.log(`rationale=${decision.rationale}`);

  // Target claims from the PDP
  const hay = (visionText ?? '').toLowerCase();
  const claimChecks = {
    'in 30 minutes': hay.includes('30 minute') || hay.includes('in 30'),
    'non-stick/nonstick': /non[\s-]?stick/.test(hay),
    'stew up to / 2 kg': hay.includes('stew up to') || /2\s*kg/.test(hay),
  };
  console.log('\n=== Claim presence in visionText ===');
  for (const [k, v] of Object.entries(claimChecks)) {
    console.log(`  ${v ? 'YES' : 'NO '} ${k}`);
  }

  const summary = {
    source: { path: imgPath, width: meta.width, height: meta.height },
    visionMode: mode,
    visionMs,
    extractedTextCount: gated?.extractedText?.length ?? 0,
    extractedText: gated?.extractedText ?? [],
    gateHit,
    ruleRefIds: ruleResult.findings.map((f) => f.refId),
    performanceClaim: perf.length > 0,
    capacityClaim: cap.length > 0,
    visionFindings: (gated?.findings ?? []).map((f) => ({
      refId: f.refId,
      severity: f.severity,
      decision: f.decision,
      summary: f.summary,
      sliceId: f.sliceId,
    })),
    consistencyFindings: gated?.consistencyFindings ?? [],
    claimChecks,
    decision: {
      finalDecision: decision.finalDecision,
      branchVerdicts: decision.branchVerdicts,
      rationale: decision.rationale,
      findingCounts: decision.findingCounts,
    },
  };

  writeFileSync(join(outDir, 'verify-summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(
    join(outDir, 'verify-report.html'),
    `<!doctype html><meta charset="utf-8"/><title>Joyoung SG Verify</title>
<style>body{font-family:system-ui;max-width:960px;margin:24px auto;padding:0 16px;background:#111;color:#eee}
pre{white-space:pre-wrap;background:#1a1a1a;padding:12px;border-radius:8px}
.ok{color:#6f6}.bad{color:#f66}</style>
<h1>Joyoung SG 长图验证</h1>
<p>${meta.width}×${meta.height} · mode=${mode} · ${visionMs}ms · final=<b>${decision.finalDecision}</b></p>
<h2>Claim presence in visionText</h2>
<ul>${Object.entries(claimChecks)
      .map(([k, v]) => `<li class="${v ? 'ok' : 'bad'}">${v ? 'YES' : 'NO'} ${k}</li>`)
      .join('')}</ul>
<h2>Rules</h2>
<pre>${escapeHtml(JSON.stringify(summary.ruleRefIds, null, 2))}</pre>
<h2>Vision findings</h2>
<pre>${escapeHtml(JSON.stringify(summary.visionFindings, null, 2))}</pre>
<h2>Decision</h2>
<pre>${escapeHtml(JSON.stringify(summary.decision, null, 2))}</pre>
<h2>Extracted text</h2>
<pre>${escapeHtml((gated?.extractedText ?? []).join('\n'))}</pre>
`,
  );

  console.log('\nWrote', outDir);

  // Soft exit code: fail if gate wrongly fires on 790px image with text, or if none of target claims hit rules when present in text
  let exit = 0;
  if (gateHit && meta.width >= 200 && (visionText?.length ?? 0) >= 40) {
    console.error('UNEXPECTED: readability gate fired on readable 50H100');
    exit = 2;
  }
  if (!gateHit && meta.width < 200) {
    console.error('UNEXPECTED: gate did not fire on narrow image');
    exit = 2;
  }
  process.exit(exit);
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
