/**
 * CN P1 health-cluster golden gate.
 * Usage: node scripts/run-cn-p1-golden.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gold = JSON.parse(
  readFileSync(join(root, 'demo/golden/cn-p1-health-batches.json'), 'utf8'),
);

const IGNORE = new Set(['demo-cn-internet-ad-identifiable-tag']);
const engine = new RuleEngineService();
const playbook = new PlaybookEngineService();
const decision = new DecisionEngineService();

function evaluate(categoryId, text) {
  const c = {
    reviewId: `p1-${Math.random().toString(36).slice(2, 8)}`,
    normalizedContent: { text },
    dimensions: { countryId: 'CN', categoryId, platformId: 'META' },
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
    playbook: playbookResult.findings.map((f) => f.refId),
  };
}

const failures = [];
let total = 0;

function checkCase(batchName, c, defaults = {}) {
  total += 1;
  const expectDecision = c.expect_decision ?? defaults.expect_decision;
  const expectRuleAny = c.expect_rule_any ?? defaults.expect_rule_any ?? [];
  const expectNoRules = defaults.expect_no_rules ?? [];
  const got = evaluate(c.category_id, c.text);

  if (expectDecision && got.decision !== expectDecision) {
    failures.push({
      id: c.id,
      batch: batchName,
      kind: 'decision',
      expect: expectDecision,
      got: got.decision,
      rules: got.rules,
      text: c.text,
    });
    return;
  }
  if (expectRuleAny.length && !expectRuleAny.some((r) => got.rules.includes(r))) {
    failures.push({
      id: c.id,
      batch: batchName,
      kind: 'rule-miss',
      expect: expectRuleAny.join('|'),
      got: got.rules.join(',') || '—',
      text: c.text,
    });
    return;
  }
  if (expectNoRules.length) {
    const hit = got.rules.filter((r) => expectNoRules.includes(r));
    if (hit.length) {
      failures.push({
        id: c.id,
        batch: batchName,
        kind: 'negative-fp',
        expect: 'none',
        got: hit.join(','),
        text: c.text,
      });
    }
  }
}

const { health_implication, health_blocker, negatives } = gold.batches;
for (const c of health_implication.cases) {
  checkCase('health_implication', c, {
    expect_decision: health_implication.expect_decision,
    expect_rule_any: health_implication.expect_rule_any,
  });
}
for (const c of health_blocker.cases) {
  checkCase('health_blocker', c, {
    expect_decision: health_blocker.expect_decision,
    expect_rule_any: health_blocker.expect_rule_any,
  });
}
for (const c of negatives.cases) {
  checkCase('negatives', c, {
    expect_decision: negatives.expect_decision,
    expect_no_rules: negatives.expect_no_rules,
  });
}

console.log(`=== CN P1 health golden (${gold.gold_id}) ===`);
console.log(`cases=${total} failures=${failures.length}`);
if (failures.length) {
  for (const f of failures) {
    console.log(
      `FAIL [${f.batch}/${f.id}] ${f.kind}: expect=${f.expect} got=${f.got} | ${f.text}`,
    );
  }
  process.exit(1);
}
console.log('PASS all CN P1 health gold cases');
