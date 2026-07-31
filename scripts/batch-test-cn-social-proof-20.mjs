/**
 * CN social-proof / quantified sales 20-line batch (rule + playbook, local).
 * Legal gold (demo-rule-1.8.18): REJECT≥8 absolute/perfect-rate; WARN≥11 unsourced metrics; PASS=0.
 * Usage: node scripts/batch-test-cn-social-proof-20.mjs
 */
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';

const engine = new RuleEngineService();
const playbook = new PlaybookEngineService();
const decision = new DecisionEngineService();

/** All 20 are unsourced sales/social-proof or ranking claims — content risk expected. */
const lines = [
  { id: 1, text: '全球累计销量突破1000万台。', expect: 'WARN' },
  { id: 2, text: '每分钟售出100台。', expect: 'WARN' },
  { id: 3, text: '已服务超过5000万家庭用户。', expect: 'WARN' },
  { id: 4, text: '用户好评率高达100%。', expect: 'REJECT' },
  { id: 5, text: '售后满意度连续十年保持100%。', expect: 'REJECT' },
  { id: 6, text: '98%的用户使用后都会再次购买。', expect: 'WARN' },
  { id: 7, text: '全国已有3000万消费者选择我们。', expect: 'WARN' },
  { id: 8, text: '连续365天稳居销量榜第一。', expect: 'REJECT' },
  { id: 9, text: '每10个家庭就有8个在使用本产品。', expect: 'WARN' },
  { id: 10, text: '用户推荐率达到99.99%。', expect: 'REJECT' },
  { id: 11, text: '单日销售额突破亿元。', expect: 'WARN' },
  { id: 12, text: '全平台复购率行业第一。', expect: 'REJECT' },
  { id: 13, text: '产品上市首月销量超百万台。', expect: 'WARN' },
  { id: 14, text: '零投诉、零差评、零退货。', expect: 'REJECT' },
  { id: 15, text: '已获得超过1000万个五星好评。', expect: 'WARN' },
  { id: 16, text: '全网销量遥遥领先其他品牌。', expect: 'REJECT' },
  { id: 17, text: '平均每秒成交3单。', expect: 'WARN' },
  { id: 18, text: '用户满意率100%，退货率为0。', expect: 'REJECT' },
  { id: 19, text: '全国超过90%的消费者认可。', expect: 'WARN' },
  { id: 20, text: '连续五年蝉联销量冠军。', expect: 'REJECT' },
];

const rank = { PASS: 0, INFO: 1, WARN: 2, REVIEW: 3, REJECT: 4 };

function ctx(text) {
  return {
    reviewId: `cn-sp-${Math.random().toString(36).slice(2, 8)}`,
    normalizedContent: { text },
    dimensions: { countryId: 'CN', categoryId: 'sa.other', platformId: 'META' },
    advertisementContext: {},
    resolvedKnowledgeVersions: {},
  };
}

function shortRule(id) {
  return id
    .replace(/^demo-apac-sa-/, 'apac:')
    .replace(/^demo-cn-/, 'cn:')
    .replace(/^demo-sg-sa-/, 'sg:')
    .replace(/^demo-my-sa-/, 'my:');
}

/** Ignore publish-checklist INFO when judging content-risk coverage. */
function contentRules(findings) {
  return findings.filter((f) => f.refId !== 'demo-cn-internet-ad-identifiable-tag');
}

const rows = [];
for (const line of lines) {
  const c = ctx(line.text);
  const ruleResult = engine.evaluate(c);
  const playbookResult = playbook.evaluate(c);
  const final = decision.fuseFromFindings({
    reviewId: c.reviewId,
    hasBlocker: ruleResult.hasBlocker,
    ruleFindings: ruleResult.findings,
    playbookFindings: playbookResult.findings,
    llmFindings: [],
  });

  const content = contentRules(ruleResult.findings);
  const rules = content.map((f) => `${shortRule(f.refId)}:${f.decision}`);
  const patterns = playbookResult.findings.map((f) => f.refId);
  const got = final.finalDecision;
  const expected = line.expect;
  // drifted = weaker than expected, or PASS with no content finding when expect WARN+
  const drifted =
    (rank[got] ?? 0) < (rank[expected] ?? 0) ||
    (expected !== 'PASS' && content.length === 0);

  rows.push({
    id: line.id,
    decision: got,
    expect: expected,
    drifted,
    rules,
    playbook: patterns,
    text: line.text,
  });
}

const reject = rows.filter((r) => r.decision === 'REJECT').length;
const warn = rows.filter((r) => r.decision === 'WARN').length;
const pass = rows.filter((r) => r.decision === 'PASS').length;
const other = rows.filter((r) => !['REJECT', 'WARN', 'PASS'].includes(r.decision)).length;
const drifted = rows.filter((r) => r.drifted);

console.log('=== CN social-proof / quantified 20-line batch (rule+playbook, no LLM) ===');
console.log(
  `REJECT=${reject}  WARN=${warn}  PASS=${pass}  other=${other}  drifted(偏低/漏检)=${drifted.length}/20`,
);
console.log('');
for (const r of rows) {
  const flag = r.drifted ? '⚠漏' : '✓';
  const ruleStr = r.rules.join(', ') || '—';
  const pb = r.playbook.length ? ` pb=[${r.playbook.join(',')}]` : '';
  console.log(
    `${String(r.id).padStart(2)}. [${flag}] got=${r.decision.padEnd(6)} expect=${r.expect.padEnd(6)} | ${ruleStr}${pb}`,
  );
  console.log(`    ${r.text}`);
}

console.log('');
console.log('--- 漏检/偏低清单 ---');
if (drifted.length === 0) {
  console.log('(none)');
} else {
  for (const r of drifted) {
    console.log(
      `#${r.id} got=${r.decision} expect=${r.expect} | ${r.text} | rules=${r.rules.join(',') || '—'}`,
    );
  }
}
