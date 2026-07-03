import { runGoldenBenchmarkEval, defaultGoldenBenchmarkOutputPath } from './golden-benchmark-evaluator.service.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputArgIndex = args.indexOf('--output');
  const outputPath =
    outputArgIndex >= 0 ? args[outputArgIndex + 1] : defaultGoldenBenchmarkOutputPath();
  const casesArgIndex = args.indexOf('--cases');
  const casesPath = casesArgIndex >= 0 ? args[casesArgIndex + 1] : undefined;
  const noWrite = args.includes('--no-write');

  const result = await runGoldenBenchmarkEval({
    casesPath,
    outputPath: noWrite ? undefined : outputPath,
    writeReport: !noWrite,
  });

  console.log(JSON.stringify(result.summary, null, 2));

  if (result.failed_case_ids.length > 0) {
    console.error(`Failed cases (${result.failed_case_ids.length}): ${result.failed_case_ids.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
