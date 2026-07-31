/**
 * CN absolute-claim 20-line batch (rule + playbook, local).
 * Target after demo-rule-1.8.17 lexicon expansion: 20/20 REJECT via demo-cn-absolute-terms-blocker.
 * Usage: node scripts/batch-test-cn-absolute-20.mjs
 */
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';

const engine = new RuleEngineService();
const playbook = new PlaybookEngineService();
const decision = new DecisionEngineService();

/** Legal expectation: all 20 are Art.9-style absolute / superlative risk for CN. */
const lines = [
  { id: 1, category: 'sa.air_fryer', text: '全球领先的智能空气炸锅品牌。' },
  { id: 2, category: 'sa.other', text: '行业第一品质，千万家庭共同选择。' },
  { id: 3, category: 'sa.blender_processor', text: '全网最好用的破壁机，没有之一。' },
  { id: 4, category: 'sa.other', text: '顶级配置，全面超越同类产品。' },
  { id: 5, category: 'sa.other', text: '史上最强空气净化产品正式上市。' },
  { id: 6, category: 'sa.other', text: '厨房小家电领域领导品牌。' },
  { id: 7, category: 'sa.other', text: '全国销量第一，用户口碑第一。' },
  { id: 8, category: 'sa.blender_processor', text: '唯一能够满足全场景需求的料理机。' },
  { id: 9, category: 'sa.other', text: '同类产品中的终极解决方案。' },
  { id: 10, category: 'sa.other', text: '不容置疑的行业标杆产品。' },
  { id: 11, category: 'sa.other', text: '国家级品质认证，值得信赖。' },
  { id: 12, category: 'sa.other', text: '中国最佳厨房生活品牌。' },
  { id: 13, category: 'sa.other', text: '业内最先进加热技术。' },
  { id: 14, category: 'sa.other', text: '效果远超市场上所有竞品。' },
  { id: 15, category: 'sa.other', text: '登顶行业巅峰的旗舰新品。' },
  { id: 16, category: 'sa.other', text: '市场占有率稳居第一。' },
  { id: 17, category: 'sa.other', text: '性能表现无人能及。' },
  { id: 18, category: 'sa.other', text: '重新定义行业最高标准。' },
  { id: 19, category: 'sa.other', text: '用户满意度行业第一。' },
  { id: 20, category: 'sa.other', text: '真正意义上的全能王者。' },
];

function ctx({ category, text }) {
  return {
    reviewId: `cn-abs-${Math.random().toString(36).slice(2, 8)}`,
    normalizedContent: { text },
    dimensions: { countryId: 'CN', categoryId: category, platformId: 'META' },
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

const rows = [];
for (const line of lines) {
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

  const rules = ruleResult.findings.map((f) => shortRule(f.refId));
  const patterns = playbookResult.findings.map((f) => f.refId);
  const hitCnAbsolute = ruleResult.findings.some((f) => f.refId === 'demo-cn-absolute-terms-blocker');
  const hitApacAbsolute = ruleResult.findings.some((f) =>
    f.refId === 'demo-apac-sa-absolute-claim' || f.refId === 'demo-apac-sa-absolute-claim-soft',
  );
  // Expected: REJECT for CN Art.9 absolute language. PASS/REVIEW without absolute hit = 偏离(漏检)
  const expectedReject = true;
  const drifted = expectedReject && final.finalDecision !== 'REJECT' && !hitCnAbsolute;

  rows.push({
    id: line.id,
    decision: final.finalDecision,
    hitCnAbsolute,
    hitApacAbsolute,
    drifted,
    rules,
    playbook: patterns,
    text: line.text,
  });
}

const reject = rows.filter((r) => r.decision === 'REJECT').length;
const review = rows.filter((r) => r.decision === 'REVIEW').length;
const pass = rows.filter((r) => r.decision === 'PASS').length;
const drifted = rows.filter((r) => r.drifted);

console.log('=== CN absolute 20-line batch (rule+playbook, no LLM) ===');
console.log(`REJECT=${reject}  REVIEW=${review}  PASS=${pass}  drifted(漏检)=${drifted.length}/20`);
console.log('');
for (const r of rows) {
  const flag = r.drifted ? '⚠漏' : r.decision === 'REJECT' ? '✓' : '~';
  const ruleStr = r.rules.join(', ') || '—';
  const pb = r.playbook.length ? ` pb=[${r.playbook.join(',')}]` : '';
  console.log(
    `${String(r.id).padStart(2)}. [${flag}] ${r.decision.padEnd(6)} cnAbs=${r.hitCnAbsolute ? 'Y' : 'N'} apacAbs=${r.hitApacAbsolute ? 'Y' : 'N'} | ${ruleStr}${pb}`,
  );
  console.log(`    ${r.text}`);
}

console.log('');
console.log('--- 漏检清单 (expected REJECT / Art.9 risk, engine did not REJECT via CN absolute) ---');
if (drifted.length === 0) {
  console.log('(none)');
} else {
  for (const r of drifted) {
    console.log(`#${r.id} ${r.decision} | ${r.text} | rules=${r.rules.join(',') || '—'}`);
  }
}
