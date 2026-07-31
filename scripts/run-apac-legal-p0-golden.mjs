/**
 * APAC Legal Director P0 golden (cure BLOCKER + brand #ad WARN).
 * Usage: node scripts/run-apac-legal-p0-golden.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gold = JSON.parse(
  readFileSync(join(root, 'demo/golden/apac-legal-p0-batches.json'), 'utf8'),
);

const IGNORE = new Set([
  'demo-cn-internet-ad-identifiable-tag',
  'demo-sg-cpsr-registration-prerequisite',
  'demo-my-eeca-coe-prerequisite',
]);

const engine = new RuleEngineService();
const playbook = new PlaybookEngineService();
const decision = new DecisionEngineService();

function evaluate(countryId, categoryId, text) {
  const c = {
    reviewId: `apac-p0-${Math.random().toString(36).slice(2, 8)}`,
    normalizedContent: { text },
    dimensions: { countryId, categoryId, platformId: 'META' },
    advertisementContext: {},
    resolvedKnowledgeVersions: {},
  };
  const ruleResult = engine.evaluate(c);
  const playbookResult = playbook.evaluate(c);
  const final = decision.fuseFromFindings({
    reviewId: c.reviewId,
    hasBlocker: ruleResult.hasBlocker,
    ruleFindings: ruleResult.findings,
    playbookFindings: playbookResult.findings,
    llmFindings: [],
  });
  return {
    decision: final.finalDecision,
    rules: ruleResult.findings.filter((f) => !IGNORE.has(f.refId)).map((f) => f.refId),
  };
}

const failures = [];
let total = 0;
const markets = gold.markets;

function checkCase(batchName, countryId, c, defaults) {
  total += 1;
  const got = evaluate(countryId, c.category_id, c.text);
  const id = `${countryId}/${c.id}`;

  if (defaults.expect_decision && got.decision !== defaults.expect_decision) {
    failures.push({
      id,
      batch: batchName,
      kind: 'decision',
      expect: defaults.expect_decision,
      got: got.decision,
      rules: got.rules,
      text: c.text,
    });
    return;
  }
  if (defaults.expect_rule_any?.length && !defaults.expect_rule_any.some((r) => got.rules.includes(r))) {
    failures.push({
      id,
      batch: batchName,
      kind: 'rule-miss',
      expect: defaults.expect_rule_any.join('|'),
      got: got.rules.join(',') || '—',
      text: c.text,
    });
    return;
  }
  if (defaults.expect_no_rules?.length) {
    const hit = got.rules.filter((r) => defaults.expect_no_rules.includes(r));
    if (hit.length) {
      failures.push({
        id,
        batch: batchName,
        kind: 'negative-fp',
        expect: 'none',
        got: hit.join(','),
        text: c.text,
      });
    }
  }
}

const { p0_1_cure_reject, p0_2_disclosure_warn, negatives } = gold.batches;
for (const countryId of markets) {
  for (const c of p0_1_cure_reject.cases) {
    checkCase('p0_1_cure_reject', countryId, c, p0_1_cure_reject);
  }
  for (const c of p0_2_disclosure_warn.cases) {
    checkCase('p0_2_disclosure_warn', countryId, c, p0_2_disclosure_warn);
  }
  for (const c of negatives.cases) {
    checkCase('negatives', countryId, c, negatives);
  }
}

console.log(`=== APAC Legal P0 golden (${gold.gold_id}) ===`);
console.log(`cases=${total} failures=${failures.length}`);
if (failures.length) {
  for (const f of failures) {
    console.log(
      `FAIL [${f.batch}/${f.id}] ${f.kind}: expect=${f.expect} got=${f.got} | ${f.text}`,
    );
  }
  process.exit(1);
}
console.log('PASS all APAC Legal P0 gold cases');
