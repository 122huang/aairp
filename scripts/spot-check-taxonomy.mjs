import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';

const engine = new RuleEngineService();
const decision = new DecisionEngineService();

function ctx(text, country = 'SG', category = 'sa.rice_cooker') {
  return {
    reviewId: 'spot',
    normalizedContent: { text },
    dimensions: { countryId: country, categoryId: category },
    advertisementContext: {},
    resolvedKnowledgeVersions: {},
  };
}

function evaluate(label, text, country = 'SG') {
  const ruleResult = engine.evaluate(ctx(text, country));
  const final = decision.fuseFromFindings({
    reviewId: 'spot',
    hasBlocker: ruleResult.hasBlocker,
    ruleFindings: ruleResult.findings,
    playbookFindings: [],
    llmFindings: [],
  });
  const rules = ruleResult.findings.map((f) => f.refId).join(', ') || '—';
  return { label, text: text.slice(0, 50), decision: final.finalDecision, rules };
}

const samples = [
  ['医疗', '促进肠胃消化，提升免疫力'],
  ['医疗', '降低心血管疾病风险，守护全家健康'],
  ['医疗', 'Helps manage blood sugar levels for diabetic users'],
  ['食品', '晚上放入鸡肉食材，早上起床即享热腾腾的鸡肉粥'],
  ['食品', 'Load raw chicken before bed, wake up to a perfectly cooked meal'],
  ['虚假认证', '经新加坡卫生部临床认证，除螨率100%'],
  ['虚假认证', 'Certified by Singapore Ministry of Health — eliminates all dust mites'],
  ['竞品', '比Midea同类产品吸力强50%'],
  ['竞品', '50% more suction than Dyson with Dyson logo visible'],
  ['定价', '划线价 $299 现售 $99，但该产品从未以$299销售'],
  ['定价', '48-hour flash sale banner live continuously for over 60 days'],
  ['绝对化', '新加坡销量第一电饭煲'],
  ['绝对化', 'Never fails, never disappoints'],
  ['量化', '比传统油炸减少高达80%用油量'],
  ['比较级', '更强劲的吸力'],
  ['比较级', 'More powerful suction — no baseline product specified'],
  ['健康暗示', '少油烹饪，吃得更轻盈'],
  ['健康暗示', 'Feel the difference — cleaner eating starts here'],
  ['材质', '食品级材质，接触食物更放心'],
  ['HEPA', 'HEPA级过滤，有效净化室内空气'],
  ['类比', '媲美柴火慢煮的香气与口感'],
  ['环保', '环保设计，守护地球未来'],
  ['本地化', '认证图引用 CQC / GB标准'],
  ['本地化', 'Copy contains placeholder text: [TBD]'],
];

for (const [cat, text] of samples) {
  const r = evaluate(cat, text);
  console.log(`${r.decision.padEnd(6)} [${cat}] ${r.rules} | ${r.text}`);
}
