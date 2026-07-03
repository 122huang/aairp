/**
 * Offline batch review — uses RuleEngine + Playbook from demo packs (latest on disk).
 * Usage: node scripts/batch-review-sg-country.mjs
 */
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';
import { DEMO_KNOWLEDGE_VERSIONS } from '../packages/application/dist/review/context-builder.service.js';

const CASES = [
  // Block A — SG lifestyle (中文)
  { block: 'A-生活方式', country: 'SG', product: '电饭煲', category: 'sa.rice_cooker', text: '内置控温程序，轻松还原米饭自然香气。' },
  { block: 'A-生活方式', country: 'SG', product: '吸尘器', category: 'sa.vacuum_floor', text: '多层过滤设计，全面清洁地板与地毯表面。' },
  { block: 'A-生活方式', country: 'SG', product: '搅拌机', category: 'sa.blender_processor', text: '五档调速，轻松应对不同食材需求。' },
  { block: 'A-生活方式', country: 'SG', product: '空气炸锅', category: 'sa.air_fryer', text: '360°热风循环，无需预热，即放即炸。' },
  { block: 'A-生活方式', country: 'SG', product: '搅拌机', category: 'sa.blender_processor', text: '大容量设计，满足全家日常备餐所需。' },
  // Block B — SG lifestyle (英文)
  { block: 'B-生活方式', country: 'SG', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Multi-layer filtration captures dust, pet hair and fine particles.' },
  { block: 'B-生活方式', country: 'SG', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Twelve cooking modes for jasmine rice, brown rice and porridge.' },
  { block: 'B-生活方式', country: 'SG', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Rapid hot-air circulation for a crispy finish with minimal oil.' },
  { block: 'B-生活方式', country: 'SG', product: 'Blender', category: 'sa.blender_processor', text: '1,000W motor handles ice, nuts and fibrous greens with ease.' },
  { block: 'B-生活方式', country: 'SG', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Four-litre capacity — designed for Singapore family meal prep.' },
  // Block C — SG claims-heavy (中文)
  { block: 'C-功效宣称', country: 'SG', product: '空气炸锅', category: 'sa.air_fryer', text: '比传统油炸减少高达80%的用油量，让美食更轻盈。' },
  { block: 'C-功效宣称', country: 'SG', product: '吸尘器', category: 'sa.vacuum_floor', text: '深层清除床垫螨虫，有效减少室内过敏源。' },
  { block: 'C-功效宣称', country: 'SG', product: '电饭煲', category: 'sa.rice_cooker', text: '模拟柴火慢煮，还原传统米香与口感。' },
  { block: 'C-功效宣称', country: 'SG', product: '搅拌机', category: 'sa.blender_processor', text: '冷萃技术，最大程度保留果蔬天然营养成分。' },
  { block: 'C-功效宣称', country: 'SG', product: '空气炸锅', category: 'sa.air_fryer', text: '少油烹饪，让全家饮食更加轻松无负担。' },
  // Block D — SG claims-heavy (英文)
  { block: 'D-功效宣称', country: 'SG', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Slow-cook mode delivers the texture of traditional clay-pot cooking.' },
  { block: 'D-功效宣称', country: 'SG', product: 'Blender', category: 'sa.blender_processor', text: 'Cold-blend technology designed to preserve more of the natural goodness in your fruits and vegetables.' },
  { block: 'D-功效宣称', country: 'SG', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Removes up to 99% of household dust — tested under standard lab conditions.' },
  { block: 'D-功效宣称', country: 'SG', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Up to 80% less oil compared to conventional deep frying.' },
  { block: 'D-功效宣称', country: 'SG', product: 'Blender', category: 'sa.blender_processor', text: 'Engineered to support your daily nutrition routine.' },
];

function reviewCase(ruleEngine, playbookEngine, decisionEngine, c) {
  const context = {
    reviewId: 'rev_batch',
    advertisementId: 'ad_batch',
    contentHash: 'hash',
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: c.country,
      platformId: 'META',
      categoryId: c.category,
    },
    normalizedContent: { text: c.text, imageUrls: [] },
    resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
    advertisementContext: { adFormat: 'text' },
    tags: [],
    builtAt: new Date().toISOString(),
  };

  const rules = ruleEngine.evaluate(context);
  const playbook = playbookEngine.evaluate(context);
  const decision = decisionEngine.fuseFromFindings({
    reviewId: context.reviewId,
    hasBlocker: rules.hasBlocker,
    ruleFindings: rules.findings,
    playbookFindings: playbook.findings,
    llmFindings: [],
  });

  const actionable = [...rules.findings, ...playbook.findings].filter(
    (f) => f.decision === 'WARN' || f.decision === 'FAIL',
  );

  return {
    decision: decision.finalDecision,
    refs: actionable.map((f) => f.refId).join(', ') || '—',
    summaries: actionable.map((f) => `[${f.module}] ${f.refId}: ${f.summary}`),
  };
}

const ruleEngine = new RuleEngineService();
const playbookEngine = new PlaybookEngineService();
const decisionEngine = new DecisionEngineService();

console.log(`\n# 新加坡批量审核（离线引擎 · ${DEMO_KNOWLEDGE_VERSIONS.rulePackVersion}）\n`);
console.log('| 组 | 品类 | 决策 | 命中 | 文案 |');
console.log('|---|------|------|------|------|');

let i = 0;
const stats = { PASS: 0, WARN: 0, REJECT: 0 };
for (const c of CASES) {
  i += 1;
  const r = reviewCase(ruleEngine, playbookEngine, decisionEngine, c);
  stats[r.decision] = (stats[r.decision] ?? 0) + 1;
  const short = c.text.length > 42 ? `${c.text.slice(0, 39)}…` : c.text;
  console.log(
    `| ${c.block} | ${c.product} | **${r.decision}** | ${r.refs} | ${short.replace(/\|/g, '\\|')} |`,
  );
}

console.log(`\n**合计**: PASS ${stats.PASS ?? 0} · WARN ${stats.WARN ?? 0} · REJECT ${stats.REJECT ?? 0}\n`);

// Country scope demo: same line, different countries
const probe = 'Up to 80% less oil compared to conventional deep frying.';
console.log('## 国别范围探测（同一条英文 · 空气炸锅）\n');
for (const country of ['SG', 'MY', 'TH', 'US', 'CN']) {
  const r = reviewCase(ruleEngine, playbookEngine, decisionEngine, {
    block: 'probe',
    country,
    product: 'Air Fryer',
    category: 'sa.air_fryer',
    text: probe,
  });
  console.log(`- **${country}**: ${r.decision} · ${r.refs}`);
}
