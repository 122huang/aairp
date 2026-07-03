import { writeRewriteCoverageReport } from './rewrite-corpus-dashboard.js';

async function main(): Promise<void> {
  const report = writeRewriteCoverageReport();
  console.log('Rewrite Corpus Coverage Report');
  console.log(`  entries: ${report.corpus_size}`);
  console.log(`  KQS: ${report.knowledge_quality_score.overall}%`);
  console.log(`  missing strategies: ${report.missing_strategies.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
