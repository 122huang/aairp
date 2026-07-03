import { writeRegulationCoverageReport } from './regulation-corpus-dashboard.js';

async function main(): Promise<void> {
  const report = writeRegulationCoverageReport();
  console.log('Regulation Coverage Report');
  console.log(`  corpus size: ${report.corpus_size}`);
  console.log(`  KQS: ${report.knowledge_quality_score.overall}%`);
  console.log(`  freshness green/yellow/red: ${report.freshness.green}/${report.freshness.yellow}/${report.freshness.red}`);
  console.log(`  orphan entries: ${report.linkage_coverage.entries_orphan}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
