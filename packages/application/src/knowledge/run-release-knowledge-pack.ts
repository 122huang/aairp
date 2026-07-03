import { releaseKnowledgePack } from './knowledge-pack-release.js';
import { validateKnowledgePack } from './knowledge-pack-validator.js';

async function main(): Promise<void> {
  const releasedBy = process.env.AAIRP_PACK_RELEASED_BY ?? 'knowledge-eng@aairp';
  const supersedes = process.env.AAIRP_PACK_SUPERSEDES;

  const pack = releaseKnowledgePack({
    released_by: releasedBy,
    supersedes: supersedes || undefined,
  });

  const validation = validateKnowledgePack(pack, { checkLiveManifests: false });
  console.log('Knowledge Pack Release');
  console.log(`  pack_id: ${pack.knowledge_pack_id}`);
  console.log(`  fingerprint: ${pack.knowledge_pack_fingerprint}`);
  console.log(`  released_by: ${pack.released_by}`);
  console.log(`  supersedes: ${pack.supersedes ?? '(none)'}`);
  console.log(`  validation passed: ${validation.passed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
