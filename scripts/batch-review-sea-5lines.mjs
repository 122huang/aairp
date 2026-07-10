/**
 * Batch review 5 EN copy lines across SG / MY / TH (local pipeline, no HTTP).
 * Usage: node scripts/batch-review-sea-5lines.mjs
 */
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'packages/application/dist/review');

const { DEMO_KNOWLEDGE_VERSIONS } = await import(pathToFileURL(join(dist, 'context-builder.service.js')).href);
const { ReviewPipelineService } = await import(pathToFileURL(join(dist, 'review-pipeline.service.js')).href);
const { RuleEngineService } = await import(pathToFileURL(join(dist, 'rule-engine.service.js')).href);
const { PlaybookEngineService } = await import(pathToFileURL(join(dist, 'playbook-engine.service.js')).href);
const { OpenRiskDiscoveryService } = await import(pathToFileURL(join(dist, 'open-risk-discovery.service.js')).href);
const { DecisionEngineService } = await import(pathToFileURL(join(dist, 'decision-engine.service.js')).href);
const { ReviewReportService } = await import(pathToFileURL(join(dist, 'review-report.service.js')).href);

process.env.AAIRP_VISION_MODE ??= 'off';
process.env.AAIRP_REWRITE_MODE ??= 'off';
process.env.AAIRP_OPEN_RISK_MODE ??= 'stub';

const COUNTRIES = ['SG', 'MY', 'TH'];
const LINES = [
  { id: 1, text: 'One sweep is all it takes to remove every trace of dust.', category: 'sa.vacuum_floor' },
  { id: 2, text: 'Start every morning with a healthier lifestyle.', category: 'sa.air_fryer' },
  { id: 3, text: 'A cleaner home for a healthier family.', category: 'sa.vacuum_floor' },
  { id: 4, text: 'Perfect rice, every single time.', category: 'sa.rice_cooker' },
  { id: 5, text: 'Make every meal a healthier choice.', category: 'sa.air_fryer' },
];

const pipeline = new ReviewPipelineService({
  ruleEngineService: new RuleEngineService(),
  playbookEngineService: new PlaybookEngineService(),
  openRiskDiscoveryService: new OpenRiskDiscoveryService(),
  decisionEngineService: new DecisionEngineService(),
  reviewReportService: new ReviewReportService(),
});

function buildContext(country, line) {
  return {
    reviewId: `rev_${country}_${line.id}`,
    advertisementId: `ad_${country}_${line.id}`,
    contentHash: `hash_${line.id}`,
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: country,
      platformId: 'META',
      categoryId: line.category,
    },
    normalizedContent: { text: line.text, imageUrls: [] },
    resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
    advertisementContext: {},
    tags: [],
    builtAt: new Date().toISOString(),
  };
}

const rows = [];
for (const country of COUNTRIES) {
  for (const line of LINES) {
    const result = await pipeline.runThroughReport(buildContext(country, line));
    const hits = result.report.summary.findings.filter(
      (f) => f.decision === 'WARN' || f.decision === 'FAIL' || f.decision === 'REJECT',
    );
    rows.push({
      country,
      line: line.id,
      text: line.text,
      category: line.category,
      decision: result.decision.finalDecision,
      findings: hits.map((f) => ({
        module: f.module,
        ref: f.refId,
        severity: f.severity,
        summary: f.summary.slice(0, 120),
      })),
    });
    process.stderr.write(`${country} #${line.id} ${result.decision.finalDecision}\n`);
  }
}

const byCountry = {};
for (const c of COUNTRIES) {
  byCountry[c] = { PASS: 0, WARN: 0, REJECT: 0 };
  for (const row of rows.filter((r) => r.country === c)) {
    byCountry[c][row.decision] = (byCountry[c][row.decision] ?? 0) + 1;
  }
}

console.log(JSON.stringify({ modes: { open_risk: process.env.AAIRP_OPEN_RISK_MODE, vision: process.env.AAIRP_VISION_MODE }, stats: byCountry, rows }, null, 2));
