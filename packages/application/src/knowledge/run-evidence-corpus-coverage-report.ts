import { writeEvidenceCoverageReport } from './evidence-corpus-dashboard.js';

async function main(): Promise<void> {
  const report = writeEvidenceCoverageReport();
  console.log('Evidence Corpus Coverage Report');
  console.log(`  entries: ${report.corpus_size}`);
  console.log(`  KQS: ${report.knowledge_quality_score.overall}%`);
  console.log(`  missing types: ${report.missing_types.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
