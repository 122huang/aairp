import { writeKnowledgeVisibilitySnapshot } from './knowledge-visibility-snapshot.js';

async function main(): Promise<void> {
  const snapshot = writeKnowledgeVisibilitySnapshot();
  console.log('Knowledge Visibility Snapshot');
  console.log(`  schema: ${snapshot.schema_version}`);
  console.log(`  pack: ${snapshot.knowledge_pack.knowledge_pack_id ?? '(none)'}`);
  console.log(`  status: ${snapshot.knowledge_pack.release_status}`);
  console.log(`  entries: ${snapshot.platform.total_entries}`);
  console.log(`  graph nodes: ${snapshot.graph.nodes.length}`);
  console.log(`  graph edges: ${snapshot.graph.edges.length}`);
  if (snapshot.knowledge_pack.draft_warning) {
    console.log(`  warning: ${snapshot.knowledge_pack.draft_warning}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
