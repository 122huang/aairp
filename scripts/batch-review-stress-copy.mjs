/**
 * Stress-test ad copy batch via live API.
 * Usage: node scripts/batch-review-stress-copy.mjs
 */
const BASE = process.env.AAIRP_BASE ?? 'http://localhost:3000';

const CASES = [
  // Block 1 — high-risk mix (default SG)
  { id: 1, group: '高风险', country: 'SG', product: '搅拌机', category: 'sa.blender_processor', text: '每日一杯，促进肠胃消化，全面提升免疫力。' },
  { id: 2, group: '高风险', country: 'SG', product: '电饭煲', category: 'sa.rice_cooker', text: '新加坡销量第一电饭煲，品质无可超越。' },
  { id: 3, group: '高风险', country: 'SG', product: '空气炸锅', category: 'sa.air_fryer', text: '零油烹饪，彻底告别心血管疾病威胁，守护全家健康。' },
  { id: 4, group: '高风险', country: 'SG', product: '吸尘器', category: 'sa.vacuum_floor', text: '99.9%杀菌除螨，经临床验证，保护家人肺部健康。' },
  { id: 5, group: '高风险', country: 'SG', product: 'Blender', category: 'sa.blender_processor', text: 'Clinically proven to improve nutrient absorption — drink your way to better health.' },
  { id: 6, group: '高风险', country: 'SG', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Medical-grade filtration — eliminates 99.9% of bacteria and allergens.' },
  { id: 7, group: '高风险', country: 'SG', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Zero oil. Zero cholesterol risk. Endorsed by Singapore cardiologists.' },
  { id: 8, group: '高风险', country: 'SG', product: 'Rice Cooker', category: 'sa.rice_cooker', text: "Singapore's #1 rice cooker — nothing else comes close." },
  // Block 2 — lifestyle / moderate
  { id: 9, group: '生活方式', country: 'SG', product: '电饭煲', category: 'sa.rice_cooker', text: '晚上放入鸡肉食材，早上起床即享热腾腾的鸡肉粥。' },
  { id: 10, group: '生活方式', country: 'SG', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Load raw chicken before bed, wake up to a perfectly cooked meal tomorrow morning.' },
  { id: 11, group: '生活方式', country: 'SG', product: '空气炸锅', category: 'sa.air_fryer', text: '减少用油，保留食材天然风味，日常烹饪更轻盈。' },
  { id: 12, group: '生活方式', country: 'SG', product: '搅拌机', category: 'sa.blender_processor', text: '冷压提取原理，尽量保留鲜果中的天然营养成分。' },
  { id: 13, group: '生活方式', country: 'SG', product: '吸尘器', category: 'sa.vacuum_floor', text: '强力吸附微细尘粒，有效减少室内空气浮尘。' },
  { id: 14, group: '生活方式', country: 'SG', product: '电饭煲', category: 'sa.rice_cooker', text: '模拟柴火慢煮原理，还原传统口感与米香。' },
  { id: 15, group: '生活方式', country: 'SG', product: '空气炸锅', category: 'sa.air_fryer', text: '同样酥脆效果，减少高达75%用油量。' },
  { id: 16, group: '生活方式', country: 'SG', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Fuzzy logic technology adapts to moisture levels for more consistent cooking results.' },
  { id: 17, group: '生活方式', country: 'SG', product: 'Blender', category: 'sa.blender_processor', text: 'Designed to help retain the natural enzymes in fresh tropical produce.' },
  { id: 18, group: '生活方式', country: 'SG', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'HEPA-class filtration captures fine particulates for improved indoor air quality.' },
  { id: 19, group: '生活方式', country: 'SG', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Cuts oil use by up to 75% compared to traditional deep-frying methods.' },
  { id: 20, group: '生活方式', country: 'SG', product: 'Blender', category: 'sa.blender_processor', text: 'Powerful enough for durian flesh, frozen fruits and classic Milo ice blends.' },
  // Block 3 — elevated Chinese
  { id: 21, group: '功效加强', country: 'SG', product: '搅拌机', category: 'sa.blender_processor', text: '每日一杯活性酵素饮，排毒净体，由内而外焕发光彩。' },
  { id: 22, group: '功效加强', country: 'MY', product: '空气炸锅', category: 'sa.air_fryer', text: '马来西亚销量冠军，永远是最好的选择。' },
  { id: 23, group: '功效加强', country: 'SG', product: '吸尘器', category: 'sa.vacuum_floor', text: '经权威机构临床认证，除螨率100%，全面净化居家空气。' },
  { id: 24, group: '功效加强', country: 'SG', product: '电饭煲', category: 'sa.rice_cooker', text: '晚上放入牛腩食材，隔夜慢炖，清晨开盖即享软烂肉饭。' },
  { id: 25, group: '功效加强', country: 'SG', product: '搅拌机', category: 'sa.blender_processor', text: '低GI饮食必备，助力控糖，适合糖尿病患者日常使用。' },
  // Block 4 — Malaysia EN
  { id: 26, group: '马来西亚', country: 'MY', product: 'Vacuum', category: 'sa.vacuum_floor', text: "Malaysia's #1 trusted vacuum brand — certified by national health authorities." },
  { id: 27, group: '马来西亚', country: 'MY', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Eat fried food without the health consequences — oil-free cooking eliminates all health risks.' },
  { id: 28, group: '马来西亚', country: 'MY', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Prep raw fish and marinated chicken before bed — wake up to a fresh Malaysian breakfast.' },
  { id: 29, group: '马来西亚', country: 'MY', product: 'Blender', category: 'sa.blender_processor', text: 'Doctor-recommended for patients managing diabetes and high cholesterol.' },
  { id: 30, group: '马来西亚', country: 'MY', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Kills 100% of dust mites — pharmaceutical-grade sterilisation at home.' },
  // Block 5 — Thailand EN
  { id: 31, group: '泰国', country: 'TH', product: 'Vacuum', category: 'sa.vacuum_floor', text: "Clinically proven by Thailand's Ministry of Public Health — eliminates all allergy-causing dust mites." },
  { id: 32, group: '泰国', country: 'TH', product: 'Rice Cooker', category: 'sa.rice_cooker', text: "Thailand's No.1 rice cooker — unmatched quality, unbeatable taste, every single time." },
  { id: 33, group: '泰国', country: 'TH', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Load raw pork and marinated fish before bed — wake up to a fully cooked Thai-style breakfast.' },
  { id: 34, group: '泰国', country: 'TH', product: 'Blender', category: 'sa.blender_processor', text: 'Detox juice that cleanses your liver and boosts immunity — rooted in traditional Thai herbal medicine.' },
  { id: 35, group: '泰国', country: 'TH', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Zero oil, zero fat, zero cholesterol — medically endorsed for heart disease and diabetes management.' },
  // Block 6 — Thailand / regional ZH
  { id: 36, group: '泰国中文', country: 'TH', product: '搅拌机', category: 'sa.blender_processor', text: '泰国销量排名第一，品质经权威机构认证，无出其右。' },
  { id: 37, group: '泰国中文', country: 'TH', product: '空气炸锅', category: 'sa.air_fryer', text: '无油即可烹饪，医学证明降低心脏病风险，守护全家健康。' },
  { id: 38, group: '泰国中文', country: 'TH', product: '吸尘器', category: 'sa.vacuum_floor', text: '灭螨率100%，经泰国卫生部临床认证，呵护过敏人群。' },
  { id: 39, group: '泰国中文', country: 'TH', product: '电饭煲', category: 'sa.rice_cooker', text: '晚上将猪肉与大米一同放入，隔夜慢炖，清晨开盖即是一锅热粥。' },
  { id: 40, group: '泰国中文', country: 'TH', product: '搅拌机', category: 'sa.blender_processor', text: '专为糖尿病患者设计，低GI蔬果汁助力稳定血糖。' },
];

async function review(c) {
  const res = await fetch(`${BASE}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      country_id: c.country,
      platform_id: 'META',
      category_id: c.category,
      content: { text: c.text },
    }),
  });
  if (!res.ok) throw new Error(`${c.id}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function waitForApi(maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

const rows = [];
for (const c of CASES) {
  const r = await review(c);
  const actionable = (r.summary?.findings ?? []).filter(
    (f) => f.decision === 'WARN' || f.decision === 'REJECT' || f.decision === 'FAIL',
  );
  rows.push({
    ...c,
    decision: r.final_decision,
    rulePack: r.resolved_knowledge_versions?.rule_pack_version ?? r.knowledge_versions?.rule_pack_version ?? '—',
    refs: actionable.map((f) => f.ref_id).join(', ') || '—',
    summaries: actionable.map((f) => `[${f.module}] ${f.ref_id}: ${f.summary}`),
  });
}

const stats = { PASS: 0, WARN: 0, REJECT: 0 };
for (const r of rows) stats[r.decision] = (stats[r.decision] ?? 0) + 1;

console.log(JSON.stringify({ stats, rulePack: rows[0]?.rulePack, rows }, null, 2));
