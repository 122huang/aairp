import { assembleAndWriteDraft } from './knowledge-pack-release.js';
import { validateAndMarkDraft } from './knowledge-pack-manifest.js';

async function main(): Promise<void> {
  assembleAndWriteDraft();
  const { pack, validation } = validateAndMarkDraft();
  console.log('Knowledge Pack manifest (draft assembled + validated)');
  console.log(`  pack_id: ${pack.knowledge_pack_id}`);
  console.log(`  fingerprint: ${pack.knowledge_pack_fingerprint}`);
  console.log(`  status: ${pack.release_status}`);
  console.log(`  passed: ${validation.passed}`);
  console.log(
    `  case corpus coverage: ${pack.evaluation_linkage.case_corpus.benchmark_coverage.covered}/${pack.evaluation_linkage.case_corpus.benchmark_coverage.total}`,
  );

  if (!validation.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
