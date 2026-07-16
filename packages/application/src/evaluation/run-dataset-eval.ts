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
  console.log(`Decision Accuracy (all markets): ${(result.metrics.decision_accuracy * 100).toFixed(1)}%`);

  const { legal_reviewed_markets, unreviewed_markets } = result.metrics;
  console.log(
    `  Legal-reviewed markets (${legal_reviewed_markets.country_ids.join(',')}): ` +
      `${legal_reviewed_markets.passed_cases}/${legal_reviewed_markets.total_cases} passed, ` +
      `${(legal_reviewed_markets.decision_accuracy * 100).toFixed(1)}% accuracy`,
  );
  if (unreviewed_markets.total_cases > 0) {
    console.log(
      `  ⚠ No legal market card yet (${unreviewed_markets.country_ids.join(',')}): ` +
        `${unreviewed_markets.passed_cases}/${unreviewed_markets.total_cases} passed, ` +
        `${(unreviewed_markets.decision_accuracy * 100).toFixed(1)}% accuracy on demo rules only — ` +
        `not a legal-reviewed result`,
    );
  }

  if (result.failed_case_ids.length > 0) {
    console.error(`Failed cases: ${result.failed_case_ids.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
