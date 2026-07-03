import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuleEngineService } from '../packages/application/dist/review/rule-engine.service.js';
import { PlaybookEngineService } from '../packages/application/dist/review/playbook-engine.service.js';
import { DecisionEngineService } from '../packages/application/dist/review/decision-engine.service.js';

const corpus = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../benchmark/user-lines-14.json'), 'utf8'),
);

const engine = new RuleEngineService();
const playbook = new PlaybookEngineService();
const decision = new DecisionEngineService();

const lines = corpus.cases.map((c, index) => ({
  id: index + 1,
  country: c.country_id,
  category: c.category_id,
  text: c.text,
  case_id: c.case_id,
}));

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

  const rules = ruleResult.findings.map((f) => f.refId.replace('demo-apac-sa-', '').replace('demo-my-sa-', 'my-'));
  const patterns = playbookResult.findings.map((f) => f.refId);
  console.log(
    JSON.stringify({
      id: line.id,
      case_id: line.case_id,
      decision: final.finalDecision,
      country: line.country,
      rules,
      playbook: patterns,
      text: line.text,
    }),
  );
}
