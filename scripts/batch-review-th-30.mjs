/**
 * Thailand 30-line ad copy batch (live API).
 * Usage: node scripts/batch-review-th-30.mjs
 */
const BASE = process.env.AAIRP_BASE ?? 'http://localhost:3000';

const CASES = [
  { block: 'A·生活方式·中文', id: 'A1', product: '空气炸锅', category: 'sa.air_fryer', text: '符合泰国220V标准电压，开箱即用。' },
  { block: 'A·生活方式·中文', id: 'A2', product: '搅拌机', category: 'sa.blender_processor', text: '不锈钢刀片，轻松处理热带水果与冰块。' },
  { block: 'A·生活方式·中文', id: 'A3', product: '电饭煲', category: 'sa.rice_cooker', text: '专属茉莉香米模式，还原泰国长粒米自然香气。' },
  { block: 'A·生活方式·中文', id: 'A4', product: '吸尘器', category: 'sa.vacuum_floor', text: '可拆卸无袋尘桶，清洗方便，日常维护轻松。' },
  { block: 'A·生活方式·中文', id: 'A5', product: '空气炸锅', category: 'sa.air_fryer', text: '双面循环加热，无需翻面，均匀受热。' },

  { block: 'A·生活方式·英文', id: 'A6', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Jasmine rice mode — calibrated for Thai hom mali fragrance and grain texture.' },
  { block: 'A·生活方式·英文', id: 'A7', product: 'Blender', category: 'sa.blender_processor', text: 'Stainless-steel blades engineered for tropical fruits, ice and fresh coconut.' },
  { block: 'A·生活方式·英文', id: 'A8', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Bagless design with washable filter — straightforward maintenance for Thai households.' },
  { block: 'A·生活方式·英文', id: 'A9', product: 'Air Fryer', category: 'sa.air_fryer', text: "มอก.-certified for safe operation on Thailand's 220V electrical standard." },
  { block: 'A·生活方式·英文', id: 'A10', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Keep-warm function maintains serving temperature for up to 12 hours after cooking.' },

  { block: 'B·功效宣称·中文', id: 'B1', product: '吸尘器', category: 'sa.vacuum_floor', text: '高效过滤微细尘粒，有助改善室内空气品质。' },
  { block: 'B·功效宣称·中文', id: 'B2', product: '电饭煲', category: 'sa.rice_cooker', text: '与同类产品相比节能高达30%，减少家庭电费支出。' },
  { block: 'B·功效宣称·中文', id: 'B3', product: '搅拌机', category: 'sa.blender_processor', text: '低温冷萃设计，保留更多水果天然营养。' },
  { block: 'B·功效宣称·中文', id: 'B4', product: '空气炸锅', category: 'sa.air_fryer', text: '与传统油炸方式相比，减少高达70%的食用油用量。' },
  { block: 'B·功效宣称·中文', id: 'B5', product: '吸尘器', category: 'sa.vacuum_floor', text: '深度清洁地毯纤维，有效减少室内螨虫数量。' },

  { block: 'B·功效宣称·英文', id: 'B6', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Uses up to 70% less oil than traditional frying — same crispy results, lighter on the stomach.' },
  { block: 'B·功效宣称·英文', id: 'B7', product: 'Blender', category: 'sa.blender_processor', text: 'Cold-blend function designed to minimise heat damage to natural vitamins.' },
  { block: 'B·功效宣称·英文', id: 'B8', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Sensor-adjusted cooking reduces energy use by up to 25% vs. conventional models.' },
  { block: 'B·功效宣称·英文', id: 'B9', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Multi-layer filtration captures fine dust particles to support cleaner indoor air.' },
  { block: 'B·功效宣称·英文', id: 'B10', product: 'Air Fryer', category: 'sa.air_fryer', text: "Reheat yesterday's pad see ew — crispy finish without added oil." },

  { block: 'C·高风险·中文', id: 'C1', product: '搅拌机', category: 'sa.blender_processor', text: '泰国销量排名第一，品质经权威机构认证，无出其右。' },
  { block: 'C·高风险·中文', id: 'C2', product: '空气炸锅', category: 'sa.air_fryer', text: '无油即可烹饪，医学证明降低心脏病风险，守护全家健康。' },
  { block: 'C·高风险·中文', id: 'C3', product: '吸尘器', category: 'sa.vacuum_floor', text: '灭螨率100%，经泰国卫生部临床认证，呵护过敏人群。' },
  { block: 'C·高风险·中文', id: 'C4', product: '电饭煲', category: 'sa.rice_cooker', text: '晚上将猪肉与大米一同放入，隔夜慢炖，清晨开盖即是一锅热粥。' },
  { block: 'C·高风险·中文', id: 'C5', product: '搅拌机', category: 'sa.blender_processor', text: '专为糖尿病患者设计，低GI蔬果汁助力稳定血糖。' },

  { block: 'C·高风险·英文', id: 'C6', product: 'Vacuum', category: 'sa.vacuum_floor', text: "Clinically proven by Thailand's Ministry of Public Health — eliminates all allergy-causing dust mites." },
  { block: 'C·高风险·英文', id: 'C7', product: 'Rice Cooker', category: 'sa.rice_cooker', text: "Thailand's No.1 rice cooker — unmatched quality, unbeatable taste, every single time." },
  { block: 'C·高风险·英文', id: 'C8', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Load raw pork and marinated fish before bed — wake up to a fully cooked Thai-style breakfast.' },
  { block: 'C·高风险·英文', id: 'C9', product: 'Blender', category: 'sa.blender_processor', text: 'Detox juice that cleanses your liver and boosts immunity — rooted in traditional Thai herbal medicine.' },
  { block: 'C·高风险·英文', id: 'C10', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Zero oil, zero fat, zero cholesterol — medically endorsed for heart disease and diabetes management.' },
];

async function review(c) {
  const res = await fetch(`${BASE}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      country_id: 'TH',
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
    ruleRefs: hits.filter((f) => f.module === 'RULE').map((f) => f.ref_id),
  });
}

const stats = { PASS: 0, WARN: 0, REJECT: 0 };
for (const row of rows) stats[row.decision] = (stats[row.decision] ?? 0) + 1;

const byBlock = {};
for (const row of rows) {
  byBlock[row.block] ??= { PASS: 0, WARN: 0, REJECT: 0 };
  byBlock[row.block][row.decision]++;
}

console.log(JSON.stringify({ country: 'TH', stats, byBlock, rows }, null, 2));
