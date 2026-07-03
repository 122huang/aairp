import { validateAndMarkDraft } from './knowledge-pack-manifest.js';

async function main(): Promise<void> {
  const { pack, validation } = validateAndMarkDraft();
  console.log('Knowledge Pack Validation');
  console.log(`  pack_id: ${pack.knowledge_pack_id}`);
  console.log(`  status: ${pack.release_status}`);
  console.log(`  passed: ${validation.passed}`);
  console.log(`  errors: ${validation.error_count}`);
  console.log(`  warnings: ${validation.warn_count}`);

  if (validation.error_count > 0) {
    console.log('\nErrors:');
    for (const issue of validation.issues.filter((item) => item.severity === 'error')) {
      console.log(`  [${issue.tier}/${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
  }

  if (validation.warn_count > 0) {
    console.log('\nWarnings (non-blocking):');
    for (const issue of validation.issues.filter((item) => item.severity === 'warn')) {
      console.log(`  [${issue.tier}/${issue.code}] ${issue.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
