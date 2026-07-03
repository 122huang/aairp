import { validateCaseCorpus } from './case-corpus-validator.js';

async function main(): Promise<void> {
  const result = validateCaseCorpus();
  console.log('Case Corpus Validation');
  console.log(`  entries: ${result.entry_count}`);
  console.log(`  passed: ${result.passed}`);
  console.log(`  errors: ${result.error_count}`);
  console.log(`  governance warnings: ${result.warn_count}`);

  if (result.error_count > 0) {
    console.log('\nErrors:');
    for (const issue of result.issues.filter((item) => item.severity === 'error')) {
      console.log(`  [${issue.code}] ${issue.case_id}: ${issue.message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
