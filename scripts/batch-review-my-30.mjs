/**
 * Malaysia 30-line ad copy batch (live API).
 * Usage: node scripts/batch-review-my-30.mjs
 */
const BASE = process.env.AAIRP_BASE ?? 'http://localhost:3000';

const CASES = [
  { block: 'A·生活方式·中文', id: 'A1', product: '电饭煲', category: 'sa.rice_cooker', text: '精控水温，从茉莉香米到糙米一键切换。' },
  { block: 'A·生活方式·中文', id: 'A2', product: '吸尘器', category: 'sa.vacuum_floor', text: '无线设计，续航长达45分钟，自由移动无束缚。' },
  { block: 'A·生活方式·中文', id: 'A3', product: '搅拌机', category: 'sa.blender_processor', text: '静音马达，不打扰家人休息时光。' },
  { block: 'A·生活方式·中文', id: 'A4', product: '空气炸锅', category: 'sa.air_fryer', text: '旋钮式控温，操作直观，上手即用。' },
  { block: 'A·生活方式·中文', id: 'A5', product: '电饭煲', category: 'sa.rice_cooker', text: '内置保温功能，随时都有温热米饭。' },

  { block: 'A·生活方式·英文', id: 'A6', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Adjustable temperature from 80°C to 200°C for versatile Malaysian home cooking.' },
  { block: 'A·生活方式·英文', id: 'A7', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Effective on tiles, hardwood and low-pile rugs — built for Malaysian homes.' },
  { block: 'A·生活方式·英文', id: 'A8', product: 'Blender', category: 'sa.blender_processor', text: 'BPA-free jug with tool-free blade removal for quick and easy cleaning.' },
  { block: 'A·生活方式·英文', id: 'A9', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Compatible with local jasmine rice, brown rice and glutinous rice varieties.' },
  { block: 'A·生活方式·英文', id: 'A10', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Up to 45 minutes of continuous cordless runtime on a single charge.' },

  { block: 'B·功效宣称·中文', id: 'B1', product: '空气炸锅', category: 'sa.air_fryer', text: '减少用油，保留食材天然风味，日常烹饪更轻盈。' },
  { block: 'B·功效宣称·中文', id: 'B2', product: '搅拌机', category: 'sa.blender_processor', text: '冷压提取原理，尽量保留鲜果中的天然营养成分。' },
  { block: 'B·功效宣称·中文', id: 'B3', product: '吸尘器', category: 'sa.vacuum_floor', text: '强力吸附微细尘粒，有效减少室内空气浮尘。' },
  { block: 'B·功效宣称·中文', id: 'B4', product: '电饭煲', category: 'sa.rice_cooker', text: '模拟柴火慢煮原理，还原传统口感与米香。' },
  { block: 'B·功效宣称·中文', id: 'B5', product: '空气炸锅', category: 'sa.air_fryer', text: '同样酥脆效果，减少高达75%用油量。' },

  { block: 'B·功效宣称·英文', id: 'B6', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Fuzzy logic technology adapts to moisture levels for more consistent cooking results.' },
  { block: 'B·功效宣称·英文', id: 'B7', product: 'Blender', category: 'sa.blender_processor', text: 'Designed to help retain the natural enzymes in fresh tropical produce.' },
  { block: 'B·功效宣称·英文', id: 'B8', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'HEPA-class filtration captures fine particulates for improved indoor air quality.' },
  { block: 'B·功效宣称·英文', id: 'B9', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Cuts oil use by up to 75% compared to traditional deep-frying methods.' },
  { block: 'B·功效宣称·英文', id: 'B10', product: 'Blender', category: 'sa.blender_processor', text: 'Powerful enough for durian flesh, frozen fruits and classic Milo ice blends.' },

  { block: 'C·高风险·中文', id: 'C1', product: '搅拌机', category: 'sa.blender_processor', text: '每日一杯活性酵素饮，排毒净体，由内而外焕发光彩。' },
  { block: 'C·高风险·中文', id: 'C2', product: '空气炸锅', category: 'sa.air_fryer', text: '马来西亚销量冠军，永远是最好的选择。' },
  { block: 'C·高风险·中文', id: 'C3', product: '吸尘器', category: 'sa.vacuum_floor', text: '经权威机构临床认证，除螨率100%，全面净化居家空气。' },
  { block: 'C·高风险·中文', id: 'C4', product: '电饭煲', category: 'sa.rice_cooker', text: '晚上放入牛腩食材，隔夜慢炖，清晨开盖即享软烂肉饭。' },
  { block: 'C·高风险·中文', id: 'C5', product: '搅拌机', category: 'sa.blender_processor', text: '低GI饮食必备，助力控糖，适合糖尿病患者日常使用。' },

  { block: 'C·高风险·英文', id: 'C6', product: 'Vacuum', category: 'sa.vacuum_floor', text: "Malaysia's #1 trusted vacuum brand — certified by national health authorities." },
  { block: 'C·高风险·英文', id: 'C7', product: 'Air Fryer', category: 'sa.air_fryer', text: 'Eat fried food without the health consequences — oil-free cooking eliminates all health risks.' },
  { block: 'C·高风险·英文', id: 'C8', product: 'Rice Cooker', category: 'sa.rice_cooker', text: 'Prep raw fish and marinated chicken before bed — wake up to a fresh Malaysian breakfast.' },
  { block: 'C·高风险·英文', id: 'C9', product: 'Blender', category: 'sa.blender_processor', text: 'Doctor-recommended for patients managing diabetes and high cholesterol.' },
  { block: 'C·高风险·英文', id: 'C10', product: 'Vacuum', category: 'sa.vacuum_floor', text: 'Kills 100% of dust mites — pharmaceutical-grade sterilisation at home.' },
];

async function review(c) {
  const res = await fetch(`${BASE}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      country_id: 'MY',
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

console.log(JSON.stringify({ country: 'MY', rulePack: rows[0] ? undefined : null, stats, byBlock, rows }, null, 2));
