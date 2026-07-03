const writeReports = !process.argv.includes('--no-write');
const tierArg = process.argv.find((a) => a.startsWith('--tier='));
const tier = tierArg?.split('=')[1] as 'regression' | 'extended' | undefined;
const caseIdsArg = process.argv.find((a) => a.startsWith('--caseIds='));
const caseIds = caseIdsArg
  ?.split('=')[1]
  ?.split(',')
  .map((id) => id.trim())
  .filter(Boolean);

import { runBenchmarkV3Eval } from './benchmark-v3-evaluator.service.js';

runBenchmarkV3Eval({ writeReports, tier, caseIds })
  .then((result) => {
    console.log(`Benchmark V3 eval: ${result.metrics.passed_cases}/${result.metrics.total_cases} passed`);
    console.log(`  weighted quality: ${(result.metrics.weighted_quality_score * 100).toFixed(1)}%`);
    if (result.failed_case_ids.length > 0) {
      console.log(`  failed: ${result.failed_case_ids.join(', ')}`);
    }
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
