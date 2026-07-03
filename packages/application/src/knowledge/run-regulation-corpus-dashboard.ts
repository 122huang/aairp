import { writeRegulationCorpusDashboard } from './regulation-corpus-dashboard.js';

async function main(): Promise<void> {
  const dashboard = writeRegulationCorpusDashboard();
  console.log('Regulation Corpus Dashboard');
  console.log(`  corpus size: ${dashboard.coverage.corpus_size}`);
  console.log(`  KQS: ${dashboard.coverage.knowledge_quality_score.overall}%`);
  console.log(`  freshness: green=${dashboard.coverage.freshness.green} yellow=${dashboard.coverage.freshness.yellow} red=${dashboard.coverage.freshness.red}`);
  console.log(`  ownership coverage: ${dashboard.coverage.ownership.coverage_pct}%`);
  console.log(`  rule linkage: ${dashboard.coverage.linkage_coverage.rule_linkage_pct}%`);
  console.log(`  validation errors: ${dashboard.validation.error_count}`);
  console.log(`  governance warnings: ${dashboard.validation.warn_count}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
