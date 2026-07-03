import { writeCaseCorpusDashboard } from './case-corpus-dashboard.js';

async function main(): Promise<void> {
  const dashboard = writeCaseCorpusDashboard();
  console.log('Case Corpus Dashboard');
  console.log(`  entries: ${dashboard.manifest.entry_count}`);
  console.log(`  passed: ${dashboard.validation.passed}`);
  console.log(`  KQS: ${dashboard.gap_report.asset_quality_kqs}%`);
  console.log(
    `  benchmark coverage: ${dashboard.gap_report.benchmark_covered}/${dashboard.gap_report.benchmark_total}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
