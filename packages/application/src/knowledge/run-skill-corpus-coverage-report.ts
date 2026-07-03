import { writeSkillCoverageReport } from './skill-corpus-dashboard.js';

async function main(): Promise<void> {
  const report = writeSkillCoverageReport();
  console.log('Skill Corpus Coverage Report');
  console.log(`  entries: ${report.corpus_size}`);
  console.log(`  KQS: ${report.knowledge_quality_score.overall}%`);
  console.log(`  missing claim types: ${report.missing_claim_types.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
