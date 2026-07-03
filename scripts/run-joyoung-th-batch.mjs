/**
 * Run AAIRP review on Joyoung TH test copy batch.
 * Usage: node scripts/run-joyoung-th-batch.mjs [path-to-json] [baseUrl|offline]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReviewPipelineService } from '../packages/application/dist/review/review-pipeline.service.js';
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { OpenRiskDiscoveryService } from '../packages/application/dist/review/open-risk-discovery.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';
import { ReviewReportService } from '../packages/application/dist/review/review-report.service.js';

const inputPath =
  process.argv[2] ??
  join(dirname(fileURLToPath(import.meta.url)), '../pilot/fixtures/joyoung_th_test_copy_batch.json');
const mode = process.argv[3] ?? 'offline';
const baseUrl = mode === 'offline' ? null : mode.startsWith('http') ? mode : 'http://localhost:3000';

const batch = JSON.parse(readFileSync(inputPath, 'utf8'));

const PRODUCT_CATEGORY = {
  'Soy Milk Maker': 'sa.soy_milk',
  Blender: 'sa.blender_processor',
  Multicooker: 'sa.other',
  'Rice Cooker': 'sa.rice_cooker',
  'General/Bundle': 'electronics',
};

function adText(v) {
  return [v.headline, v.body, v.cta].filter(Boolean).join(' ');
}

function buildContext(text, categoryId) {
  return {
    reviewId: 'rev_joyoung_batch',
    advertisementId: 'ad_joyoung_batch',
    contentHash: 'hash_joyoung',
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: batch.destination_market ?? 'TH',
      platformId: 'META',
      categoryId,
    },
    normalizedContent: { text, imageUrls: [] },
    resolvedKnowledgeVersions: {
      rulePackVersion: 'demo-rule-1.4.0',
      playbookPackVersion: 'demo-playbook-1.3.0',
      promptPackVersion: 'demo-open-risk-1.1.0',
    },
    advertisementContext: {},
    tags: ['joyoung-th-batch'],
    builtAt: new Date().toISOString(),
  };
}

const pipeline = new ReviewPipelineService({
  ruleEngineService: new RuleEngineService(),
  playbookEngineService: new PlaybookEngineService(),
  openRiskDiscoveryService: new OpenRiskDiscoveryService(),
  decisionEngineService: new DecisionEngineService(),
  reviewReportService: new ReviewReportService(),
});

async function reviewOffline(text, categoryId) {
  const out = await pipeline.runThroughReport(buildContext(text, categoryId));
  const findings = out.report.summary.findings.map((f) => ({
    module: f.module,
    ref_id: f.refId,
    summary: f.summary,
    severity: f.severity,
  }));
  return {
    final_decision: out.report.summary.finalDecision,
    confidence: out.decision.confidence,
    rationale: out.decision.rationale,
    findings,
    open_risk_skipped: out.report.summary.openRiskSkipped,
  };
}

async function reviewLive(text, categoryId) {
  const res = await fetch(`${baseUrl}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      country_id: batch.destination_market ?? 'TH',
      platform_id: 'META',
      category_id: categoryId,
      content: { text },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const body = await res.json();
  return {
    final_decision: body.final_decision,
    confidence: body.confidence,
    rationale: body.rationale,
    findings: (body.summary?.findings ?? []).map((f) => ({
      module: f.module,
      ref_id: f.ref_id ?? f.refId,
      summary: f.summary,
      severity: f.severity,
    })),
    open_risk_skipped: body.summary?.open_risk_skipped,
  };
}

function alignManual(status, engineDecision) {
  const manual = status?.toLowerCase();
  if (manual === 'green') {
    if (engineDecision === 'PASS') return 'ALIGNED';
    if (engineDecision === 'WARN') return 'ENGINE_STRICTER';
    return 'MISMATCH';
  }
  if (manual === 'yellow') {
    if (engineDecision === 'PASS') return 'ENGINE_MISSED';
    if (engineDecision === 'WARN' || engineDecision === 'REJECT') return 'ALIGNED';
    return 'MISMATCH';
  }
  if (manual === 'red') {
    if (engineDecision === 'REJECT') return 'ALIGNED';
    if (engineDecision === 'WARN') return 'ENGINE_TOO_LENIENT';
    return 'ENGINE_MISSED';
  }
  return 'UNKNOWN';
}

const results = [];
for (const v of batch.variants) {
  const text = adText(v);
  const categoryId = PRODUCT_CATEGORY[v.product] ?? 'electronics';
  const actual =
    baseUrl != null ? await reviewLive(text, categoryId) : await reviewOffline(text, categoryId);
  results.push({
    id: v.id,
    product: v.product,
    angle: v.angle,
    category_id: categoryId,
    headline: v.headline,
    text_preview: text.slice(0, 120) + (text.length > 120 ? '…' : ''),
    manual_status: v.compliance_status,
    manual_notes: v.compliance_notes,
    engine_decision: actual.final_decision,
    confidence: actual.confidence,
    alignment: alignManual(v.compliance_status, actual.final_decision),
    finding_refs: actual.findings.map((f) => f.ref_id).filter(Boolean),
    findings: actual.findings,
    rationale: actual.rationale,
    open_risk_skipped: actual.open_risk_skipped,
  });
}

const summary = {
  batch_id: batch.test_batch_id,
  market: batch.destination_market,
  mode: baseUrl ?? 'offline-pipeline',
  reviewed_at: new Date().toISOString(),
  total: results.length,
  engine_pass: results.filter((r) => r.engine_decision === 'PASS').length,
  engine_warn: results.filter((r) => r.engine_decision === 'WARN').length,
  engine_reject: results.filter((r) => r.engine_decision === 'REJECT').length,
  aligned: results.filter((r) => r.alignment === 'ALIGNED').length,
  engine_stricter: results.filter((r) => r.alignment === 'ENGINE_STRICTER').length,
  engine_missed: results.filter((r) => r.alignment === 'ENGINE_MISSED').length,
  engine_too_lenient: results.filter((r) => r.alignment === 'ENGINE_TOO_LENIENT').length,
};

const outPath = join(dirname(fileURLToPath(import.meta.url)), '../pilot/results/joyoung-th-batch-run.json');
writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2), 'utf8');
console.log(JSON.stringify({ summary, results }, null, 2));
