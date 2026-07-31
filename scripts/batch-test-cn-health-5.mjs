/**
 * CN health-implication 5-line batch (rule + playbook, local).
 * Usage: node scripts/batch-test-cn-health-5.mjs
 */
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';

const engine = new RuleEngineService();
const playbook = new PlaybookEngineService();
const decision = new DecisionEngineService();

const lines = [
  { id: 1, category: 'sa.blender_processor', text: '喝了一段时间，体检指标明显比以前好看了。' },
  { id: 2, category: 'sa.air_fryer', text: '最近感觉身体轻盈了不少。' },
  { id: 3, category: 'sa.blender_processor', text: '很多人反馈坚持使用后瘦了一圈。' },
  { id: 4, category: 'sa.other', text: '家里老人用了以后精神状态好多了。' },
  { id: 5, category: 'sa.other', text: '不少用户反馈睡眠质量明显提升。' },
];

function ctx({ category, text }) {
  return {
    reviewId: `cn-hi-${Math.random().toString(36).slice(2, 8)}`,
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
    .replace(/^demo-sg-sa-/, 'sg:');
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

  const content = ruleResult.findings.filter(
    (f) => f.refId !== 'demo-cn-internet-ad-identifiable-tag',
  );
  rows.push({
    id: line.id,
    decision: final.finalDecision,
    rules: content.map((f) => `${shortRule(f.refId)}:${f.decision}`),
    playbook: playbookResult.findings.map((f) => `${f.refId}:${f.decision}`),
    text: line.text,
    category: line.category,
  });
}

console.log('=== CN health-implication 5-line batch (rule+playbook, no LLM) ===');
for (const r of rows) {
  const hit = r.rules.length || r.playbook.length ? '✓' : '⚠漏';
  console.log(
    `${String(r.id).padStart(2)}. [${hit}] ${r.decision.padEnd(6)} | rules=${r.rules.join(', ') || '—'} | pb=${r.playbook.join(', ') || '—'}`,
  );
  console.log(`    [${r.category}] ${r.text}`);
}

const miss = rows.filter((r) => r.rules.length === 0 && r.playbook.length === 0);
console.log('');
console.log(
  `summary: REJECT=${rows.filter((r) => r.decision === 'REJECT').length} WARN=${rows.filter((r) => r.decision === 'WARN').length} REVIEW=${rows.filter((r) => r.decision === 'REVIEW').length} PASS=${rows.filter((r) => r.decision === 'PASS').length} content-miss=${miss.length}/5`,
);
if (miss.length) {
  console.log('--- content miss ---');
  for (const r of miss) console.log(`#${r.id} ${r.text}`);
}

console.log('\n--- JSON ---');
console.log(JSON.stringify(rows, null, 2));
