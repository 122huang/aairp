/**
 * Rule+Playbook + OpenRisk (stub vs live) on ad-hoc copy batch.
 *
 * Usage:
 *   . scripts/load-env.ps1
 *   $env:AAIRP_OPEN_RISK_MODE = 'live'
 *   node scripts/batch-test-ad-hoc-live.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';
import { OpenRiskDiscoveryService } from '../packages/application/dist/review/open-risk-discovery.service.js';
import { createDefaultOpenRiskLlmGateway } from '../packages/application/dist/review/open-risk-llm.gateway.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = process.argv[2] ?? join(root, 'pilot/results/ad-hoc-batch-stub-vs-live.json');

const lines = [
  { id: 1, country: 'SG', category: 'sa.rice_cooker', text: '【电饭煲】煮出来的饭，老人家也说香' },
  { id: 2, country: 'SG', category: 'sa.air_fryer', text: '【空气炸锅】同样的炸鸡，不一样的第二天早晨' },
  { id: 3, country: 'SG', category: 'sa.rice_cooker', text: '[Rice Cooker] Cooked slow. Eaten well' },
  { id: 4, country: 'SG', category: 'sa.rice_cooker', text: '[Rice Cooker] Cooked slow. Eaten well' },
  { id: 5, country: 'SG', category: 'sa.blender_processor', text: '[Blender] The 6am version of you deserves better' },
  { id: 6, country: 'SG', category: 'sa.vacuum_floor', text: '【吸尘器】吸走的不只是灰尘' },
  { id: 7, country: 'SG', category: 'sa.air_fryer', text: '[Air Fryer] Your cardiologist would probably approve' },
  { id: 8, country: 'SG', category: 'sa.rice_cooker', text: '[Rice Cooker] Designed for people who think about what they eat' },
  { id: 9, country: 'SG', category: 'sa.rice_cooker', text: '[Rice Cooker] Designed for people who think about what they eat' },
  { id: 10, country: 'SG', category: 'sa.blender_processor', text: '[Blender] Whole fruits. Whole benefits' },
  { id: 11, country: 'SG', category: 'sa.rice_cooker', text: '【电饭煲】给坐月子的她，煮一锅用心的粥' },
  { id: 12, country: 'SG', category: 'sa.vacuum_floor', text: "[Vacuum] Breathe easy. We've got the rest" },
  { id: 13, country: 'SG', category: 'sa.blender_processor', text: '搅拌机：What goes in is what you choose — nothing else' },
  { id: 14, country: 'SG', category: 'sa.rice_cooker', text: '[Rice Cooker] Designed for people who think about what they eat' },
];

function ctx({ country, category, text }) {
  return {
    reviewId: `adhoc-${Math.random().toString(36).slice(2, 8)}`,
    normalizedContent: { text },
    dimensions: { countryId: country, categoryId: category, platformId: 'META' },
    advertisementContext: {},
    resolvedKnowledgeVersions: {},
  };
}

async function evaluateLine(line, mode) {
  const previousMode = process.env.AAIRP_OPEN_RISK_MODE;
  process.env.AAIRP_OPEN_RISK_MODE = mode;

  const engine = new RuleEngineService();
  const playbook = new PlaybookEngineService();
  const decision = new DecisionEngineService();
  const openRisk = new OpenRiskDiscoveryService({
    llmGateway: createDefaultOpenRiskLlmGateway(),
  });

  const c = ctx(line);
  const ruleResult = engine.evaluate(c);
  const playbookResult = playbook.evaluate(c);
  const llmResult = await openRisk.discover(c, {
    hasBlocker: ruleResult.hasBlocker,
    ruleFindings: ruleResult.findings,
    playbookFindings: playbookResult.findings,
  });
  const final = decision.fuseFromFindings({
    reviewId: c.reviewId,
    hasBlocker: ruleResult.hasBlocker,
    ruleFindings: ruleResult.findings,
    playbookFindings: playbookResult.findings,
    llmFindings: llmResult.findings,
  });

  if (previousMode === undefined) delete process.env.AAIRP_OPEN_RISK_MODE;
  else process.env.AAIRP_OPEN_RISK_MODE = previousMode;

  const rules = ruleResult.findings.map((f) =>
    f.refId.replace(/^demo-apac-sa-/, '').replace(/^demo-sg-sa-/, 'sg-').replace(/^demo-my-sa-/, 'my-'),
  );

  return {
    mode,
    decision: final.finalDecision,
    rules,
    playbook: playbookResult.findings.map((f) => f.refId),
    llm: llmResult.findings.map((f) => `${f.refId}:${f.decision}`),
    llmSkipped: llmResult.skipped ?? false,
  };
}

async function main() {
  const liveConfigured = process.env.AAIRP_OPEN_RISK_MODE?.trim().toLowerCase() === 'live';
  const results = [];

  for (const line of lines) {
    process.stderr.write(`Line ${line.id}/14 stub…\n`);
    const stub = await evaluateLine(line, 'stub');
    let live = null;
    if (liveConfigured) {
      process.stderr.write(`Line ${line.id}/14 live…\n`);
      try {
        live = await evaluateLine(line, 'live');
      } catch (error) {
        live = { mode: 'live', error: String(error.message ?? error) };
      }
    }

    const stubOnly = await (async () => {
      const engine = new RuleEngineService();
      const playbook = new PlaybookEngineService();
      const decision = new DecisionEngineService();
      const c = ctx(line);
      const ruleResult = engine.evaluate(c);
      const playbookResult = playbook.evaluate(c);
      const final = decision.fuseFromFindings({
        reviewId: c.reviewId,
        hasBlocker: ruleResult.hasBlocker,
        ruleFindings: ruleResult.findings,
        playbookFindings: playbookResult.findings,
        llmFindings: [],
      });
      return final.finalDecision;
    })();

    results.push({
      id: line.id,
      text: line.text,
      rulePlaybook: stubOnly,
      stub: stub.decision,
      live: live?.decision ?? null,
      rules: stub.rules,
      playbook: stub.playbook,
      liveLlm: live?.llm ?? [],
      delta: live && !live.error ? stub.decision !== live.decision : null,
    });

    console.log(JSON.stringify(results[results.length - 1]));
  }

  const summary = {
    generated_at: new Date().toISOString(),
    live_mode: liveConfigured,
    rule_playbook: {
      REJECT: results.filter((r) => r.rulePlaybook === 'REJECT').length,
      WARN: results.filter((r) => r.rulePlaybook === 'WARN').length,
      PASS: results.filter((r) => r.rulePlaybook === 'PASS').length,
    },
    stub_with_llm: liveConfigured
      ? null
      : {
          REJECT: results.filter((r) => r.stub === 'REJECT').length,
          WARN: results.filter((r) => r.stub === 'WARN').length,
          PASS: results.filter((r) => r.stub === 'PASS').length,
        },
    live: liveConfigured
      ? {
          REJECT: results.filter((r) => r.live === 'REJECT').length,
          WARN: results.filter((r) => r.live === 'WARN').length,
          PASS: results.filter((r) => r.live === 'PASS').length,
          deltas: results.filter((r) => r.delta).length,
        }
      : null,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
