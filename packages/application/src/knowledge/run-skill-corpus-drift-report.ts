import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSkillDriftReport, formatSkillDriftMarkdown } from './skill-corpus-drift.js';
import { skillCorpusPlugin } from './corpus/skill-corpus.plugin.js';

async function main(): Promise<void> {
  const report = buildSkillDriftReport();
  const reportsDir = skillCorpusPlugin.defaultReportsDir();
  mkdirSync(reportsDir, { recursive: true });
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  const outputPath = join(reportsDir, `skill-corpus-drift-${timestamp}.md`);
  writeFileSync(outputPath, `${formatSkillDriftMarkdown(report)}\n`);

  console.log('Skill Corpus Drift Report (non-blocking)');
  console.log(`  skill entries: ${report.skill_corpus_count}`);
  console.log(`  drift issues: ${report.issues.length}`);
  console.log(`  unmapped legacy patterns: ${report.summary.unmapped_legacy_patterns.length}`);
  console.log(`  report: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
