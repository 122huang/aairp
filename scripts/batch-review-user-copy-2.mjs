const BASE = process.env.AAIRP_BASE ?? 'http://localhost:3000';

const CASES = [
  { product: '吸尘器', category: 'sa.vacuum_floor', text: 'Designed to help simplify everyday cleaning.' },
  { product: '搅拌机', category: 'sa.blender_processor', text: 'Blend your favorite recipes with ease.' },
  { product: '电饭煲', category: 'sa.rice_cooker', text: 'Cook everyday meals with confidence.' },
  { product: '吸尘器', category: 'sa.vacuum_floor', text: 'A practical cleaning companion for your home.' },
  { product: '电饭煲', category: 'sa.rice_cooker', text: 'Simple controls for everyday cooking needs.' },
  { product: '吸尘器', category: 'sa.vacuum_floor', text: 'Spend less time cleaning and more time living.' },
  { product: '搅拌机', category: 'sa.blender_processor', text: 'Delivers consistently smooth blending results.' },
  { product: '电饭煲', category: 'sa.rice_cooker', text: 'Makes it easier to achieve delicious meals at home.' },
  { product: '吸尘器', category: 'sa.vacuum_floor', text: 'Helps remove dust from hard-to-reach spaces.' },
  { product: '电饭煲', category: 'sa.rice_cooker', text: 'Enjoy better rice with every serving.' },
  { product: '吸尘器', category: 'sa.vacuum_floor', text: "Cleans so thoroughly you'll never look back." },
  { product: '搅拌机', category: 'sa.blender_processor', text: 'Restaurant-quality blending in every use.' },
  { product: '电饭煲', category: 'sa.rice_cooker', text: 'Foolproof cooking, every single time.' },
  { product: '吸尘器', category: 'sa.vacuum_floor', text: 'The vacuum cleaner every family needs.' },
  { product: '电饭煲', category: 'sa.rice_cooker', text: 'The smarter choice than traditional rice cookers.' },
];

async function review({ text, category }) {
  const res = await fetch(`${BASE}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      country_id: 'SG',
      platform_id: 'META',
      category_id: category,
      content: { text },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

let i = 0;
const rows = [];
for (const c of CASES) {
  i += 1;
  const r = await review(c);
  const actionable = (r.summary?.findings ?? []).filter(
    (f) => f.decision === 'WARN' || f.decision === 'REJECT',
  );
  rows.push({
    id: i,
    product: c.product,
    category: c.category,
    text: c.text,
    decision: r.final_decision,
    counts: `${r.finding_counts?.rule ?? 0}/${r.finding_counts?.playbook ?? 0}/${r.finding_counts?.llm ?? 0}`,
    refs: actionable.map((f) => f.ref_id).join(', ') || '—',
    summaries: actionable.map((f) => `[${f.module}] ${f.summary}`),
  });
}

console.log('\n# 批量审核 · SG / META · 英文主文案\n');
console.log('| # | 品类 | 文案 | 决策 | R/PB/LLM | 命中 |');
console.log('|---|------|------|------|----------|------|');
for (const r of rows) {
  const short = r.text.length > 55 ? `${r.text.slice(0, 52)}…` : r.text;
  console.log(`| ${r.id} | ${r.product} | ${short.replace(/\|/g, '\\|')} | **${r.decision}** | ${r.counts} | ${r.refs} |`);
}

console.log('\n## 明细\n');
for (const r of rows) {
  console.log(`### ${r.id}. ${r.product} · ${r.decision}`);
  console.log(`- **文案**: ${r.text}`);
  console.log(`- **类目**: ${r.category}`);
  if (r.summaries.length) {
    for (const s of r.summaries) console.log(`  - ${s}`);
  } else {
    console.log(`  - 无 WARN/REJECT finding 行`);
  }
  console.log('');
}

const pass = rows.filter((r) => r.decision === 'PASS').length;
const warn = rows.filter((r) => r.decision === 'WARN').length;
const reject = rows.filter((r) => r.decision === 'REJECT').length;
console.log(`**合计**: PASS ${pass} · WARN ${warn} · REJECT ${reject}`);
