import { assembleAndWriteDraft } from './knowledge-pack-release.js';

async function main(): Promise<void> {
  const pack = assembleAndWriteDraft();
  console.log('Knowledge Pack Assembly (draft)');
  console.log(`  pack_id: ${pack.knowledge_pack_id}`);
  console.log(`  fingerprint: ${pack.knowledge_pack_fingerprint}`);
  console.log(`  corpora: ${Object.keys(pack.corpora).join(', ')}`);
  console.log(`  status: ${pack.release_status}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
