import { runDatasetEval } from './dataset-evaluator.service.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const autoOnly = args.includes('--auto');

  const result = await runDatasetEval({
    autoOnly,
    writeReports: true,
  });

  console.log(`Dataset: ${result.benchmark_id}`);
  console.log(`Cases: ${result.metrics.passed_cases}/${result.metrics.total_cases} passed`);
  console.log(`Decision Accuracy: ${(result.metrics.decision_accuracy * 100).toFixed(1)}%`);

  if (result.failed_case_ids.length > 0) {
    console.error(`Failed cases: ${result.failed_case_ids.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
