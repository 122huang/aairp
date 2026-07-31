import fs from 'node:fs';

const pack = JSON.parse(fs.readFileSync('demo/rules.demo.json', 'utf8'));
const ui = new Set(['SG', 'MY', 'TH', 'AU', 'CN', 'JP', 'KR']);

const BATCH_A = new Set([
  'demo-sg-health-forbidden-claim',
  'demo-sg-sponsored-disclosure',
  'demo-my-sponsored-disclosure',
  'demo-th-sponsored-disclosure',
  'demo-sg-sa-market-claim',
  'demo-my-sa-market-claim',
  'demo-th-sa-market-claim',
]);

const BATCH_B = new Set([
  'demo-apac-sa-health-claim-blocker',
  'demo-apac-sa-absolute-claim',
  'demo-apac-sa-food-safety-blocker',
  'demo-apac-sa-false-authority-endorsement',
  'demo-apac-sa-pricing-misrepresentation',
  'demo-apac-sa-content-consistency-blocker',
  'demo-apac-sa-competitor-trademark',
  'demo-apac-sa-performance-claim',
  'demo-apac-sa-certification-evidence',
  'demo-apac-sa-health-implication',
  'demo-apac-sa-comparative-claim',
]);

function pick(rule, batch) {
  const markets = (rule.scopes?.countries || []).filter((c) => ui.has(c));
  return {
    batch,
    rule_id: rule.rule_id,
    severity: rule.severity,
    decision: rule.decision,
    markets: markets.join(' / '),
    law_name: rule.citation?.law_name || '（缺失）',
    article: rule.citation?.article || '（缺失）',
    summary: (rule.summary_zh || rule.summary || '').replace(/\s+/g, ' ').slice(0, 100),
  };
}

const rows = [];
for (const rule of pack.rules) {
  if (BATCH_A.has(rule.rule_id)) rows.push(pick(rule, 'A'));
  else if (BATCH_B.has(rule.rule_id)) rows.push(pick(rule, 'B'));
}
rows.sort((a, b) => a.batch.localeCompare(b.batch) || a.rule_id.localeCompare(b.rule_id));

const lines = [];
lines.push('# 法务 Citation 签核表 — 批次 A + B');
lines.push('');
lines.push(`- Pack：\`${pack.pack_version}\``);
lines.push(`- 生成：${new Date().toISOString().slice(0, 10)}`);
lines.push('- 产品 UI 市场：SG / MY / TH / AU / CN / JP / KR');
lines.push('- 状态：对外 demo 前须签完；未签完须保留 UI disclaimer');
lines.push('- 再生：`node scripts/_gen_citation_signoff_ab.mjs`');
lines.push('');
lines.push('## 如何填写');
lines.push('');
lines.push('| 字段 | 说明 |');
lines.push('|---|---|');
lines.push('| 结论 | `通过` / `需改` / `暂缓` |');
lines.push('| 修正后 law_name | 若需改，写可落地的完整法条名 |');
lines.push('| 修正后 article | 条款号 / 义务要点 |');
lines.push('| 签字 | 姓名 + 日期 |');
lines.push('');
lines.push('**批次 A**：原 Demo/占位本地规则（pass 1 已去 Demo；待法务签核）。  ');
lines.push('**批次 B**：七国共用 APAC-SA 高优先级规则（pass 1 已硬化 article/领域；待法务签核）。');
lines.push('- 工程处置：`docs/knowledge/compiler/citation-signoff-disposition.md`');
lines.push('');

function section(batch, title) {
  const subset = rows.filter((r) => r.batch === batch);
  lines.push(`## 批次 ${batch} — ${title}`);
  lines.push('');
  let i = 1;
  for (const r of subset) {
    lines.push(`### ${batch}.${i} \`${r.rule_id}\``);
    lines.push('');
    lines.push(`- **市场**：${r.markets}`);
    lines.push(`- **severity / decision**：${r.severity} / ${r.decision}`);
    lines.push(`- **摘要**：${r.summary}`);
    lines.push(`- **现行 law_name**：${r.law_name}`);
    lines.push(`- **现行 article**：${r.article}`);
    lines.push('- **结论**：☐ 通过　☐ 需改　☐ 暂缓');
    lines.push('- **修正后 law_name**：');
    lines.push('- **修正后 article**：');
    lines.push('- **备注**：');
    lines.push('- **签字 / 日期**：');
    lines.push('');
    i += 1;
  }
}

section('A', 'Demo / 占位 citation（本地规则）');
section('B', '七市场 APAC-SA 高优先级');

lines.push('## 签核汇总');
lines.push('');
lines.push('| 批次 | 条数 | 通过 | 需改 | 暂缓 | 签字人 | 日期 |');
lines.push('|---|---:|---:|---:|---:|---|---|');
lines.push(`| A | ${rows.filter((r) => r.batch === 'A').length} |  |  |  |  |  |`);
lines.push(`| B | ${rows.filter((r) => r.batch === 'B').length} |  |  |  |  |  |`);
lines.push('');
lines.push('全部通过后工程动作：按修正更新 `demo/rules.demo.json` → 刷新覆盖矩阵 → 撤 `CITATION_DEMO_DISCLAIMER`。');
lines.push('');

const outPath = 'docs/knowledge/compiler/citation-signoff-batch-ab.md';
fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
try {
  fs.unlinkSync('docs/knowledge/compiler/_signoff_ab.json');
} catch {
  /* ignore */
}
console.log('wrote', outPath, 'rows=', rows.length);
