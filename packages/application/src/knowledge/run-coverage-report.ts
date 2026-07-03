import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildKnowledgeCoverageReport,
  formatCoverageMarkdown,
} from './knowledge-coverage.js';

function resolveReportsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../reports');
}

async function main(): Promise<void> {
  const report = buildKnowledgeCoverageReport();
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  const reportsDir = resolveReportsDir();
  mkdirSync(reportsDir, { recursive: true });

  const jsonPath = join(reportsDir, `knowledge-coverage-${timestamp}.json`);
  const mdPath = join(reportsDir, `knowledge-coverage-${timestamp}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, `${formatCoverageMarkdown(report)}\n`);

  console.log('Knowledge Coverage Report');
  console.log(`  patterns w/ benchmark: ${report.coverage.patterns_with_benchmark_pct}%`);
  console.log(`  rules w/ benchmark: ${report.coverage.rules_with_benchmark_pct}%`);
  console.log(`  reports: ${jsonPath}`);
  console.log(`           ${mdPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
