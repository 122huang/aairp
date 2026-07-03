import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { evidenceCorpusPlugin } from './corpus/evidence-corpus.plugin.js';
import { buildEvidenceDriftReport, formatEvidenceDriftMarkdown } from './evidence-corpus-drift.js';

async function main(): Promise<void> {
  const report = buildEvidenceDriftReport();
  const reportsDir = evidenceCorpusPlugin.defaultReportsDir();
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `evidence-corpus-drift-${timestamp}.md`),
    `${formatEvidenceDriftMarkdown(report)}\n`,
  );

  console.log('Evidence Corpus Drift Report');
  console.log(`  evidence entries: ${report.evidence_corpus_count}`);
  console.log(`  issues: ${report.issues.length}`);
  console.log(
    `  evidence:required regulations without link: ${report.summary.evidence_required_regulations_without_link}`,
  );
  console.log(`  skills missing evidence linkage: ${report.summary.skills_missing_evidence_linkage}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
