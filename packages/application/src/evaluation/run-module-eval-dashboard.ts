import { runModuleEvalDashboard, writeKnowledgeGateT2Report } from './module-eval-dashboard.js';

const tierArg = process.argv.find((a) => a.startsWith('--tier='));
const tier = (tierArg?.split('=')[1] ?? 'regression') as 'regression' | 'extended';
const noWrite = process.argv.includes('--no-write');

runModuleEvalDashboard({ tier, writeReports: !noWrite })
  .then((dashboard) => {
    const gatePath = writeKnowledgeGateT2Report(dashboard);
    const m = dashboard.eval_result.metrics;
    console.log('Skill Module Evaluation Dashboard');
    console.log(`  baseline: ${dashboard.baseline_id}`);
    console.log(`  tier: ${dashboard.tier}`);
    console.log(
      `  regression: ${m.passed_cases}/${m.total_cases} passed (${(m.weighted_quality_score * 100).toFixed(1)}%)`,
    );
    console.log(`  status: ${dashboard.regression_comparison.regression_status}`);
    console.log(`  T2 gate report: ${gatePath}`);
    for (const mod of dashboard.modules) {
      console.log(
        `  ${mod.skill_module}: ${(mod.weighted_score * 100).toFixed(1)}% quality, ${mod.regression_status}`,
      );
    }
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
