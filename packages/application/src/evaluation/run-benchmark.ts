import { runBenchmarkEval } from './benchmark-evaluator.service.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const regressionOnly = args.includes('--regression');
  const manifestArg = args.find((arg) => !arg.startsWith('--'));
  const outputArgIndex = args.indexOf('--output');
  const outputDir = outputArgIndex >= 0 ? args[outputArgIndex + 1] : undefined;

  const result = await runBenchmarkEval({
    manifestPath: manifestArg,
    outputDir,
    regressionOnly,
    writeReports: true,
  });

  console.log(`Benchmark: ${result.benchmark_id}`);
  console.log(`Cases: ${result.metrics.passed_cases}/${result.metrics.total_cases} passed`);
  console.log(`Decision Accuracy: ${(result.metrics.decision_accuracy * 100).toFixed(1)}%`);
  console.log(`BLOCKER Recall: ${(result.metrics.blocker_recall * 100).toFixed(1)}%`);
  console.log(`False REJECT Rate: ${(result.metrics.false_reject_rate * 100).toFixed(1)}%`);
  console.log(`Finding F1: ${(result.metrics.finding_f1 * 100).toFixed(1)}%`);

  if (result.failed_case_ids.length > 0) {
    console.error(`Failed cases: ${result.failed_case_ids.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
