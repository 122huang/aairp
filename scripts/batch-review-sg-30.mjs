/**
 * Singapore 30-line ad copy batch (live API).
 * Usage: node scripts/batch-review-sg-30.mjs
 */
const BASE = process.env.AAIRP_BASE ?? 'http://localhost:3000';

const CASES = [
  { block: 'A·生活方式', id: 'A1', product: '电饭煲', category: 'sa.rice_cooker', text: '内置控温程序，轻松还原米饭自然香气。' },
  { block: 'A·生活方式', id: 'A2', product: '吸尘器', category: 'sa.vacuum_floor', text: '多层过滤设计，全面清洁地板与地毯表面。' },
  { block: 'A·生活方式', id: 'A3', product: '搅拌机', category: 'sa.blender_processor', text: '五档调速，轻松应对不同食材需求。' },
  { block: 'A·生活方式', id: 'A4', product: '空气炸锅', category: 'sa.air_fryer', text: '360°热风循环，无需预热，即放即炸。' },
  { block: 'A·生活方式', id: 'A5', product: '搅拌机', category: 'sa.blender_processor', text: '大容量设计，满足全家日常备餐所需。' },
  { block: 'A·生活方式', id: 'A6', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Multi-layer filtration captures dust, pet hair and fine particles.' },
  { block: 'A·生活方式', id: 'A7', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Twelve cooking modes for jasmine rice, brown rice and porridge.' },
  { block: 'A·生活方式', id: 'A8', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Rapid hot-air circulation for a crispy finish with minimal oil.' },
  { block: 'A·生活方式', id: 'A9', product: 'Blender', category: 'sa.blender_processor', text: '1,000W motor handles ice, nuts and fibrous greens with ease.' },
  { block: 'A·生活方式', id: 'A10', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Four-litre capacity — designed for Singapore family meal prep.' },

  { block: 'B·功效宣称', id: 'B1', product: '空气炸锅', category: 'sa.air_fryer', text: '比传统油炸减少高达80%的用油量，让美食更轻盈。' },
  { block: 'B·功效宣称', id: 'B2', product: '吸尘器', category: 'sa.vacuum_floor', text: '深层清除床垫螨虫，有效减少室内过敏源。' },
  { block: 'B·功效宣称', id: 'B3', product: '电饭煲', category: 'sa.rice_cooker', text: '模拟柴火慢煮，还原传统米香与口感。' },
  { block: 'B·功效宣称', id: 'B4', product: '搅拌机', category: 'sa.blender_processor', text: '冷萃技术，最大程度保留果蔬天然营养成分。' },
  { block: 'B·功效宣称', id: 'B5', product: '空气炸锅', category: 'sa.air_fryer', text: '少油烹饪，让全家饮食更加轻松无负担。' },
  { block: 'B·功效宣称', id: 'B6', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Slow-cook mode delivers the texture of traditional clay-pot cooking.' },
  { block: 'B·功效宣称', id: 'B7', product: 'Blender', category: 'sa.blender_processor', text: 'Cold-blend technology designed to preserve more of the natural goodness in your fruits and vegetables.' },
  { block: 'B·功效宣称', id: 'B8', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Removes up to 99% of household dust — tested under standard lab conditions.' },
  { block: 'B·功效宣称', id: 'B9', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Up to 80% less oil compared to conventional deep frying.' },
  { block: 'B·功效宣称', id: 'B10', product: 'Blender', category: 'sa.blender_processor', text: 'Engineered to support your daily nutrition routine.' },

  { block: 'C·高风险', id: 'C1', product: '搅拌机', category: 'sa.blender_processor', text: '每日一杯，促进肠胃消化，全面提升免疫力。' },
  { block: 'C·高风险', id: 'C2', product: '电饭煲', category: 'sa.rice_cooker', text: '新加坡销量第一电饭煲，品质无可超越。' },
  { block: 'C·高风险', id: 'C3', product: '空气炸锅', category: 'sa.air_fryer', text: '零油烹饪，彻底告别心血管疾病威胁，守护全家健康。' },
  { block: 'C·高风险', id: 'C4', product: '吸尘器', category: 'sa.vacuum_floor', text: '99.9%杀菌除螨，经临床验证，保护家人肺部健康。' },
  { block: 'C·高风险', id: 'C5', product: '电饭煲', category: 'sa.rice_cooker', text: '晚上放入鸡肉食材，早上起床即享热腾腾的鸡肉粥。' },
  { block: 'C·高风险', id: 'C6', product: 'Blender', category: 'sa.blender_processor', text: 'Clinically proven to improve nutrient absorption — drink your way to better health.' },
  { block: 'C·高风险', id: 'C7', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Medical-grade filtration — eliminates 99.9% of bacteria and allergens.' },
  { block: 'C·高风险', id: 'C8', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Zero oil. Zero cholesterol risk. Endorsed by Singapore cardiologists.' },
  { block: 'C·高风险', id: 'C9', product: 'Rice Cooker', category: 'sa.rice_cooker', text: "Singapore's #1 rice cooker — nothing else comes close." },
  { block: 'C·高风险', id: 'C10', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Load raw chicken before bed, wake up to a perfectly cooked meal tomorrow morning.' },
];

async function review(c) {
  const res = await fetch(`${BASE}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      country_id: 'SG',
      platform_id: 'META',
      category_id: c.category,
      content: { text: c.text },
    }),
  });
  if (!res.ok) throw new Error(`${c.id}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

const rows = [];
for (const c of CASES) {
  const r = await review(c);
  const hits = (r.summary?.findings ?? []).filter(
    (f) => f.decision === 'WARN' || f.decision === 'REJECT' || f.decision === 'FAIL',
  );
  rows.push({
    ...c,
    decision: r.final_decision,
    refs: hits.map((f) => f.ref_id).join(', ') || '—',
    notes: hits.map((f) => `${f.module}/${f.ref_id}`),
  });
}

const stats = { PASS: 0, WARN: 0, REJECT: 0 };
for (const row of rows) stats[row.decision] = (stats[row.decision] ?? 0) + 1;

console.log(JSON.stringify({ country: 'SG', stats, rows }, null, 2));
