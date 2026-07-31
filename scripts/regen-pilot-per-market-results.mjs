/**
 * Regenerate demo/golden/_pilot-per-market-results.json after Legal Director P0 fixes.
 * Usage: node scripts/regen-pilot-per-market-results.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IGNORE = new Set([
  'demo-cn-internet-ad-identifiable-tag',
  'demo-sg-cpsr-registration-prerequisite',
  'demo-my-eeca-coe-prerequisite',
]);

const engine = new RuleEngineService();
const playbook = new PlaybookEngineService();
const decision = new DecisionEngineService();

function run(text, countryId, categoryId = 'sa.other') {
  const c = {
    reviewId: 'pilot',
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
    got: final.finalDecision,
    rules: ruleResult.findings
      .filter((f) => !IGNORE.has(f.refId))
      .map((f) => `${f.refId}:${f.decision}`),
    playbook: playbookResult.findings.map((f) => `${f.refId}:${f.decision}`),
  };
}

const demos = JSON.parse(
  readFileSync(join(root, 'apps/demo-ui/public/demo-cases.json'), 'utf8'),
).cases.filter((c) => c.group === 'demo');

const cnCases = [
  {
    id: 'C1',
    expect: 'REVIEW',
    category_id: 'sa.other',
    text: '深度睡眠时间更长了，第二天不困。',
  },
  {
    id: 'C2',
    expect: 'REJECT',
    category_id: 'sa.other',
    text: '全网口碑王，买家都说闭眼入。',
  },
  {
    id: 'C3',
    expect: 'REJECT',
    category_id: 'health.supplement',
    text: '提升免疫力，全家少生病。',
  },
  {
    id: 'C4',
    expect: 'PASS',
    category_id: 'health.supplement',
    text: '全家少生病。',
    accept_any: ['PASS', 'REVIEW', 'WARN'],
  },
];

const soft = [
  {
    id: 'SP01',
    expect: 'WARN',
    category_id: 'sa.other',
    text: 'Users report noticeable changes within weeks. Results speak for themselves.',
  },
  {
    id: 'SP02',
    expect: 'WARN',
    category_id: 'sa.other',
    text: 'The popularity says it all — more people are embracing this daily.',
  },
  {
    id: 'LP03',
    expect: 'PASS',
    category_id: 'sa.other',
    text: 'Designed for busy mornings. Easy to clean after everyday use.',
  },
  {
    id: 'SP10',
    expect: 'WARN',
    category_id: 'sa.other',
    text: 'I recommend it to family and friends. Experience the benefits yourself.',
  },
];

const markets = ['SG', 'MY', 'TH', 'AU', 'CN', 'JP', 'KR'];
const out = {};

for (const m of markets) {
  out[m] = {
    demos: demos.map((d) => {
      const cat = d.upload.category_id;
      const text = d.upload.content.text;
      const r = run(text, m, cat);
      const expect = d.expected_decision;
      return {
        id: d.id,
        title: d.title,
        expect,
        got: r.got,
        match: r.got === expect,
        rules: r.rules,
        playbook: r.playbook,
        text,
        category_id: cat,
        note: m === 'SG' ? '清单主市场' : '跨市场复跑 SG 演示资产',
      };
    }),
    cn: cnCases.map((c) => {
      const r = run(c.text, m, c.category_id);
      const factualMatch = c.accept_any
        ? c.accept_any.includes(r.got)
        : r.got === c.expect || (c.id === 'C4' && ['PASS', 'REVIEW', 'WARN'].includes(r.got));
      return {
        id: c.id,
        expect: c.expect,
        got: r.got,
        match: factualMatch,
        rules: r.rules,
        playbook: r.playbook,
        text: c.text,
        note:
          m === 'CN'
            ? 'CN 粘贴冒烟'
            : c.id === 'C2' || c.id === 'C3'
              ? '跨市场对照（CN 本地化规则预期可不命中）'
              : '跨市场对照（CN 文案）',
      };
    }),
    soft: soft.map((c) => {
      const r = run(c.text, m, c.category_id);
      return {
        id: c.id,
        expect: c.expect,
        got: r.got,
        match: r.got === c.expect,
        rules: r.rules,
        playbook: r.playbook,
        text: c.text,
      };
    }),
  };
}

const path = join(root, 'demo/golden/_pilot-per-market-results.json');
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`);
console.log('wrote', path);

for (const m of markets) {
  const demosOk = out[m].demos.filter((d) => d.match).length;
  const softOk = out[m].soft.filter((d) => d.match).length;
  console.log(
    m,
    `demos ${demosOk}/${out[m].demos.length}`,
    `soft ${softOk}/${out[m].soft.length}`,
    'D01',
    out[m].demos[0].got,
    'D03',
    out[m].demos[2].got,
  );
}
