import { validateSkillCorpus } from './skill-corpus-validator.js';

async function main(): Promise<void> {
  const result = validateSkillCorpus();
  console.log('Skill Corpus Validation');
  console.log(`  entries: ${result.entry_count}`);
  console.log(`  passed: ${result.passed}`);
  console.log(`  errors: ${result.error_count}`);
  console.log(`  governance warnings: ${result.warn_count}`);

  if (result.error_count > 0) {
    console.log('\nErrors:');
    for (const issue of result.issues.filter((item) => item.severity === 'error')) {
      console.log(`  [${issue.code}] ${issue.skill_id}: ${issue.message}`);
    }
    process.exitCode = 1;
  }

  if (result.warn_count > 0) {
    console.log('\nGovernance warnings (non-blocking):');
    const byCode = new Map<string, number>();
    for (const issue of result.governance_warnings) {
      byCode.set(issue.code, (byCode.get(issue.code) ?? 0) + 1);
    }
    for (const [code, count] of [...byCode.entries()].sort()) {
      console.log(`  ${code}: ${count}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
