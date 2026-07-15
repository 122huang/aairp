const writeReports = !process.argv.includes('--no-write');
const countriesArg = process.argv.find((a) => a.startsWith('--countries='));
const countries = countriesArg
  ?.split('=')[1]
  ?.split(',')
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);
const copyIdsArg = process.argv.find((a) => a.startsWith('--copyIds='));
const copyIds = copyIdsArg
  ?.split('=')[1]
  ?.split(',')
  .map((id) => Number(id.trim()))
  .filter((n) => Number.isFinite(n));

import { runGrayCopyEval } from './gray-copy-evaluator.service.js';

runGrayCopyEval({ writeReports, countries, copyIds })
  .then((result) => {
    console.log(
      `Gray-copy Open Risk eval: ${result.metrics.open_risk_capability_passed}/${result.metrics.total_cases} capability-pass (${(result.metrics.open_risk_capability_rate * 100).toFixed(1)}%)`,
    );
    console.log(
      `  must-fire caught: ${result.metrics.must_fire_caught}/${result.metrics.must_fire_total}`,
    );
    console.log(
      `  coincidence-only: ${result.metrics.coincidence_only_count}`,
    );
    console.log(`  open_risk_mode: ${result.open_risk_mode}`);
    if (result.failed_case_ids.length > 0) {
      console.log(`  capability-fail: ${result.failed_case_ids.join(', ')}`);
    }
    // Non-zero exit when capability fails — suitable for CI after prompt/model changes.
    if (result.failed_case_ids.length > 0) {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
