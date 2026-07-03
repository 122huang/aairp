import { writeSkillCorpusDashboard } from './skill-corpus-dashboard.js';

async function main(): Promise<void> {
  const dashboard = writeSkillCorpusDashboard();
  console.log('Skill Corpus Dashboard');
  console.log(`  entries: ${dashboard.manifest.entry_count}`);
  console.log(`  passed: ${dashboard.validation.passed}`);
  console.log(`  KQS: ${dashboard.manifest.knowledge_quality_score}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
