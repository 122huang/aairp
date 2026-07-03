import { writeKnowledgePackDashboard } from './knowledge-pack-dashboard.js';

async function main(): Promise<void> {
  const dashboard = writeKnowledgePackDashboard();
  console.log('Knowledge Pack Dashboard');
  const pack = dashboard.pack ?? dashboard.draft;
  console.log(`  pack_id: ${pack && 'knowledge_pack_id' in pack ? pack.knowledge_pack_id : '(none)'}`);
  console.log(`  validation passed: ${dashboard.validation?.passed ?? 'n/a'}`);
  console.log(`  released packs: ${dashboard.released_pack_ids.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
