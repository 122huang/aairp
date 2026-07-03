import { writeKnowledgeGapReport } from './knowledge-gap-report.js';

async function main(): Promise<void> {
  const report = writeKnowledgeGapReport();
  const q = report.queue_summary;
  console.log('Knowledge Coverage Gap Report');
  console.log(`  pack: ${report.linkage.knowledge_pack_id ?? '(none)'}`);
  console.log(`  P1: ${q.p1_gaps}  P2: ${q.p2_gaps}  P3: ${q.p3_gaps}  P4: ${q.p4_gaps}  P5: ${q.p5_gaps}`);
  console.log(`  evidence gaps: ${q.evidence_gaps}`);
  console.log(`  unmapped claims: ${q.unmapped_claims}`);
  console.log(`  backlog items: ${report.backlog.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
