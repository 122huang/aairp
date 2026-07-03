/**
 * One-off batch review for user-provided ad copy.
 * Usage: node scripts/batch-review-user-copy.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:3000';

const CASES = [
  {
    product: '空炸 KL600-V7',
    sku: 'KL600-V7',
    category_id: 'sa.air_fryer',
    texts: ['Easy presents for perfect results every time', 'Non-stick'],
  },
  {
    product: '压力锅 50H100',
    sku: '50H100',
    category_id: 'sa.kettle_cooker',
    texts: [
      'Cook faster',
      'Tender beef stew in 30 minutes, not 3 hours',
      'Stew up to 2kg beef',
      'Lower Sugar Healthier Every Bowl',
    ],
  },
  {
    product: '榨汁机 B3',
    sku: 'B3',
    category_id: 'sa.blender_processor',
    texts: [
      'Enhanced noise reduction',
      'Multiple presents for any recipe',
      'Less wear, less noise and more efficient power',
      'Quieter by design, less vibration, less noise',
      'No chunks',
      'easy to digest, gentle on the stomach',
      'Silky smooth for better nutrient absorption',
      'One-Touch Clean & Sterilize',
    ],
  },
  {
    product: '电饭煲 18N6U',
    sku: '18N6U',
    category_id: 'sa.rice_cooker',
    texts: ['Safer and more durable'],
  },
];

async function review(text, category_id) {
  const res = await fetch(`${BASE}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      country_id: 'SG',
      platform_id: 'META',
      category_id,
      content: { text },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function formatFindings(findings) {
  if (!findings?.length) return '—';
  return findings
    .filter((f) => f.decision === 'WARN' || f.decision === 'REJECT')
    .map((f) => `[${f.module}] ${f.ref_id}: ${f.summary}`)
    .join(' | ');
}

const rows = [];
let idx = 0;

for (const group of CASES) {
  for (const text of group.texts) {
    idx += 1;
    const id = String(idx).padStart(2, '0');
    process.stderr.write(`Reviewing ${id}/${CASES.reduce((n, g) => n + g.texts.length, 0)}: ${text.slice(0, 40)}…\n`);
    const result = await review(text, group.category_id);
    const actionable = (result.summary?.findings ?? []).filter(
      (f) => f.decision === 'WARN' || f.decision === 'REJECT',
    );
    rows.push({
      id,
      product: group.product,
      sku: group.sku,
      category: group.category_id,
      text,
      decision: result.final_decision,
      rationale: result.rationale,
      counts: result.finding_counts,
      findings: actionable,
      findings_text: formatFindings(result.summary?.findings),
    });
  }
}

console.log('\n# 批量审核结果 · SG / META\n');
console.log('| # | 产品 | 文案 | 决策 | Rule/PB/LLM | 命中要点 |');
console.log('|---|------|------|------|-------------|----------|');

for (const r of rows) {
  const counts = `${r.counts?.rule ?? 0}/${r.counts?.playbook ?? 0}/${r.counts?.llm ?? 0}`;
  const short =
    r.findings_text.length > 80 ? `${r.findings_text.slice(0, 77)}…` : r.findings_text;
  console.log(
    `| ${r.id} | ${r.product} | ${r.text.replace(/\|/g, '\\|')} | **${r.decision}** | ${counts} | ${short || '—'} |`,
  );
}

console.log('\n## 明细（含 rationale）\n');
for (const r of rows) {
  console.log(`### ${r.id}. ${r.product} — ${r.decision}`);
  console.log(`- **文案**: ${r.text}`);
  console.log(`- **类目**: ${r.category} · **SKU**: ${r.sku}`);
  console.log(`- **Rationale**: ${r.rationale}`);
  if (r.findings.length) {
    console.log('- **Findings**:');
    for (const f of r.findings) {
      console.log(`  - [${f.module}/${f.decision}] ${f.ref_id}: ${f.summary}`);
    }
  } else {
    console.log('- **Findings**: 无 WARN/REJECT');
  }
  console.log('');
}
