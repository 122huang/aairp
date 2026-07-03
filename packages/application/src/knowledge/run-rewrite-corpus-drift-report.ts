import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRewriteDriftReport, formatRewriteDriftMarkdown } from './rewrite-corpus-drift.js';
import { rewriteCorpusPlugin } from './corpus/rewrite-corpus.plugin.js';

async function main(): Promise<void> {
  const report = buildRewriteDriftReport();
  const reportsDir = rewriteCorpusPlugin.defaultReportsDir();
  mkdirSync(reportsDir, { recursive: true });
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  const outputPath = join(reportsDir, `rewrite-corpus-drift-${timestamp}.md`);
  writeFileSync(outputPath, `${formatRewriteDriftMarkdown(report)}\n`);

  console.log('Rewrite Corpus Drift Report (non-blocking)');
  console.log(`  rewrite entries: ${report.rewrite_corpus_count}`);
  console.log(`  drift issues: ${report.issues.length}`);
  console.log(`  report: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
