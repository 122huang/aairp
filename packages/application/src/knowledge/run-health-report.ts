import { writeKnowledgeHealthReport } from './knowledge-health.js';

async function main(): Promise<void> {
  const report = writeKnowledgeHealthReport();
  console.log('Knowledge Health Report');
  console.log(`  ownership coverage: ${report.accountability.ownership_coverage_pct}%`);
  console.log(`  patterns w/ benchmark: ${report.coverage.patterns_with_benchmark_pct}%`);
  console.log(`  benchmark pass rate: ${report.effectiveness.benchmark_pass_rate ?? 'n/a'}`);
  console.log(`  regression status: ${report.regression.status}`);
  console.log(`  benchmark confidence: ${report.benchmark_confidence.overall}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
