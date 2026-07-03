const BASE = 'http://localhost:3000';

const englishOnly = `Joyoung Smart IH Rice Cooker
4.0L 1200W 24h Smart Preset
Smarter Faster Better
1500W cooks in 22 minutes vs 1000W in 30 minutes
IH High Power Electromagnetic Induction Heating
Daikin Non-stick Coating from Japan
15 Layers of Safety Protection
SMART TOUCH CONTROL PANEL
Rice Quick Rice Congee Preset Function Start Cancel
What's Included: inner pot steamer measuring cup rice spoon`;

const withChinesePanel = `${englishOnly}
精华饭 Rice 快速饭 Quick Rice 稀饭 Congee
预约 Preset 功能 Function 开始 Start 取消 Cancel`;

async function review(label, text) {
  const res = await fetch(`${BASE}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'sa.rice_cooker',
      content: { text },
      context: { product_sku: '40F560L' },
    }),
  });
  const r = await res.json();
  console.log(`=== ${label} ===`);
  console.log('Decision:', r.final_decision);
  console.log('Rationale:', r.rationale);
  const fs = (r.summary?.findings ?? []).filter(
    (f) => f.decision === 'WARN' || f.decision === 'REJECT',
  );
  for (const f of fs) console.log(`  [${f.module}] ${f.ref_id}: ${f.summary}`);
  if (!fs.length) console.log('  (no WARN/REJECT finding rows)');
  console.log('');
}

await review('A 仅英文 OCR（面板中文被漏掉）', englishOnly);
await review('B OCR 含中英双语面板文字', withChinesePanel);
