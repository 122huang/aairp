import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';

const engine = new RuleEngineService();
const playbook = new PlaybookEngineService();
const decision = new DecisionEngineService();

const lines = [
  { id: 1, country: 'SG', category: 'sa.rice_cooker', text: '【电饭煲】煮出来的饭，老人家也说香' },
  { id: 2, country: 'SG', category: 'sa.air_fryer', text: '【空气炸锅】同样的炸鸡，不一样的第二天早晨' },
  { id: 3, country: 'SG', category: 'sa.rice_cooker', text: '[Rice Cooker] Cooked slow. Eaten well' },
  { id: 4, country: 'SG', category: 'sa.rice_cooker', text: '[Rice Cooker] Cooked slow. Eaten well' },
  { id: 5, country: 'SG', category: 'sa.blender_processor', text: '[Blender] The 6am version of you deserves better' },
  { id: 6, country: 'SG', category: 'sa.vacuum_floor', text: '【吸尘器】吸走的不只是灰尘' },
  { id: 7, country: 'SG', category: 'sa.air_fryer', text: '[Air Fryer] Your cardiologist would probably approve' },
  { id: 8, country: 'SG', category: 'sa.rice_cooker', text: '[Rice Cooker] Designed for people who think about what they eat' },
  { id: 9, country: 'SG', category: 'sa.rice_cooker', text: '[Rice Cooker] Designed for people who think about what they eat' },
  { id: 10, country: 'SG', category: 'sa.blender_processor', text: '[Blender] Whole fruits. Whole benefits' },
  { id: 11, country: 'SG', category: 'sa.rice_cooker', text: '【电饭煲】给坐月子的她，煮一锅用心的粥' },
  { id: 12, country: 'SG', category: 'sa.vacuum_floor', text: "[Vacuum] Breathe easy. We've got the rest" },
  { id: 13, country: 'SG', category: 'sa.blender_processor', text: '搅拌机：What goes in is what you choose — nothing else' },
  { id: 14, country: 'SG', category: 'sa.rice_cooker', text: '[Rice Cooker] Designed for people who think about what they eat' },
];

function ctx({ country, category, text }) {
  return {
    reviewId: `t${Math.random()}`,
    normalizedContent: { text },
    dimensions: { countryId: country, categoryId: category },
    advertisementContext: {},
    resolvedKnowledgeVersions: {},
  };
}

for (const line of lines) {
  const c = ctx(line);
  const ruleResult = engine.evaluate(c);
  const playbookResult = playbook.evaluate(c);
  const final = decision.fuseFromFindings({
    reviewId: c.reviewId,
    hasBlocker: ruleResult.hasBlocker,
    ruleFindings: ruleResult.findings,
    playbookFindings: playbookResult.findings,
    llmFindings: [],
  });

  const rules = ruleResult.findings.map((f) =>
    f.refId.replace(/^demo-apac-sa-/, '').replace(/^demo-sg-sa-/, 'sg-').replace(/^demo-my-sa-/, 'my-'),
  );
  const patterns = playbookResult.findings.map((f) => f.refId);
  console.log(
    JSON.stringify({
      id: line.id,
      decision: final.finalDecision,
      rules,
      playbook: patterns,
      text: line.text,
    }),
  );
}
