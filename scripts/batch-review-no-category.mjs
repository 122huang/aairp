const BASE = process.argv[2] ?? 'http://localhost:3000';

const texts = [
  'Less peeling',
  'A cleaner way to cook',
  'Low-sugar rice',
  'non-stick',
  'Finer blending smoother nutrition',
  'Ordinary Blender: Grainy & Uneven" vs "Joyoung: Silky & Smooth',
  'Smarter. Cleaner. More efficient',
  '+15% juice yield, more juice, less waste',
  '+12% purer juice, smoother, better taste',
  'zero waste',
  'Estimate 99.9999% of bacteria',
  'Fat-reducing, less fat, up to 68% less oil',
];

async function review(text, category_id) {
  const body = { country_id: 'SG', platform_id: 'META', content: { text } };
  if (category_id) body.category_id = category_id;
  const res = await fetch(`${BASE}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) return { error: `${res.status} ${raw.slice(0, 200)}` };
  return JSON.parse(raw);
}

console.log('=== 完全不传 category_id ===');
const probe = await review(texts[0], null);
console.log(probe.error ?? `OK: ${probe.final_decision}`);
console.log('');

console.log(`=== category=sa.other · 无 SKU · ${texts.length} 条 ===\n`);
let i = 0;
for (const text of texts) {
  i += 1;
  const r = await review(text, 'sa.other');
  if (r.error) {
    console.log(`#${String(i).padStart(2, '0')} ERROR ${r.error}\n`);
    continue;
  }
  const actionable = (r.summary?.findings ?? []).filter(
    (f) => f.decision === 'WARN' || f.decision === 'REJECT',
  );
  console.log(`#${String(i).padStart(2, '0')} ${r.final_decision} | ${text}`);
  console.log(`     Rationale: ${r.rationale}`);
  if (actionable.length) {
    for (const f of actionable) {
      console.log(`     [${f.module}] ${f.ref_id}: ${f.summary}`);
    }
  } else {
    console.log('     (BLOCKER 无 WARN/REJECT finding 明细)');
  }
  console.log('');
}
