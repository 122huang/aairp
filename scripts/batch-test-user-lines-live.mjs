/**
 * Compare Rule+Playbook+OpenRisk (stub vs live) on the 14 user ad lines.
 *
 * Usage (PowerShell):
 *   . scripts/load-env.ps1
 *   $env:AAIRP_OPEN_RISK_MODE = 'live'
 *   node scripts/batch-test-user-lines-live.mjs
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
const corpus = JSON.parse(readFileSync(join(root, 'benchmark/user-lines-14.json'), 'utf8'));
const outPath =
  process.argv[2] ?? join(root, 'pilot/results/user-lines-14-stub-vs-live.json');

const lines = corpus.cases.map((c, index) => ({
  id: index + 1,
  country: c.country_id,
  category: c.category_id,
  text: c.text,
  case_id: c.case_id,
}));

function ctx({ country, category, text }) {
  return {
    reviewId: `line-${Math.random().toString(36).slice(2, 8)}`,
    normalizedContent: { text },
    dimensions: { countryId: country, categoryId: category, platformId: 'META' },
    advertisementContext: {},
    resolvedKnowledgeVersions: {},
  };
}

function summarizeFindings(ruleResult, playbookResult, llmResult) {
  return {
    rules: ruleResult.findings.map((f) => f.refId.replace(/^demo-(apac|sg|my|th)-sa-/, '').replace(/^demo-my-sa-/, 'my-')),
    playbook: playbookResult.findings.map((f) => f.refId),
    llm: (llmResult.findings ?? []).map((f) => `${f.refId}:${f.decision}`),
    llmSkipped: llmResult.skipped ?? false,
    llmSkipReason: llmResult.skipReason ?? null,
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

  if (previousMode === undefined) {
    delete process.env.AAIRP_OPEN_RISK_MODE;
  } else {
    process.env.AAIRP_OPEN_RISK_MODE = previousMode;
  }

  return {
    mode,
    decision: final.finalDecision,
    ...summarizeFindings(ruleResult, playbookResult, llmResult),
  };
}

async function main() {
  const liveConfigured = process.env.AAIRP_OPEN_RISK_MODE?.trim().toLowerCase() === 'live';
  const hasKey = Boolean(
    process.env.DEEPSEEK_API_KEY?.trim() ||
      process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim(),
  );

  if (!hasKey) {
    console.error('No LLM API key found. Run: . scripts/load-env.ps1');
    process.exit(1);
  }

  const results = [];
  for (const line of lines) {
    process.stderr.write(`Line ${line.id}/14 — stub…\n`);
    const stub = await evaluateLine(line, 'stub');
    let live = null;
    if (liveConfigured) {
      process.stderr.write(`Line ${line.id}/14 — live…\n`);
      try {
        live = await evaluateLine(line, 'live');
      } catch (error) {
        live = { mode: 'live', error: String(error.message ?? error) };
      }
    }

    results.push({
      id: line.id,
      case_id: line.case_id,
      country: line.country,
      text: line.text,
      stub,
      live,
      delta:
        live && !live.error
          ? {
              decisionChanged: stub.decision !== live.decision,
              llmFindingsAdded: live.llm.filter((f) => !stub.llm.includes(f)),
            }
          : null,
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    live_mode: liveConfigured,
    provider: process.env.OPEN_RISK_LLM_PROVIDER ?? 'auto',
    totals: {
      stub: {
        REJECT: results.filter((r) => r.stub.decision === 'REJECT').length,
        WARN: results.filter((r) => r.stub.decision === 'WARN').length,
        PASS: results.filter((r) => r.stub.decision === 'PASS').length,
      },
      live: liveConfigured
        ? {
            REJECT: results.filter((r) => r.live?.decision === 'REJECT').length,
            WARN: results.filter((r) => r.live?.decision === 'WARN').length,
            PASS: results.filter((r) => r.live?.decision === 'PASS').length,
            errors: results.filter((r) => r.live?.error).length,
            decision_deltas: results.filter((r) => r.delta?.decisionChanged).length,
          }
        : null,
    },
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2), 'utf8');

  for (const row of results) {
    console.log(
      JSON.stringify({
        id: row.id,
        stub: row.stub.decision,
        live: row.live?.decision ?? (liveConfigured ? 'ERROR' : 'SKIPPED'),
        stubRules: row.stub.rules,
        liveLlm: row.live?.llm ?? [],
        delta: row.delta,
        text: row.text.slice(0, 60),
      }),
    );
  }
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
