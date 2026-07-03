import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatLinkageMarkdown,
  validateKnowledgeLinkage,
} from './linkage-validator.js';

function resolveReportsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../reports');
}

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const result = validateKnowledgeLinkage({ strict });
  const timestamp = result.validated_at.replace(/[:.]/g, '-');
  const reportsDir = resolveReportsDir();
  mkdirSync(reportsDir, { recursive: true });

  const jsonPath = join(reportsDir, `linkage-${timestamp}.json`);
  const mdPath = join(reportsDir, `linkage-${timestamp}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(mdPath, `${formatLinkageMarkdown(result)}\n`);

  console.log(`Linkage validation: ${result.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`  errors=${result.error_count} warnings=${result.warn_count}`);
  console.log(`  reports: ${jsonPath}`);
  console.log(`           ${mdPath}`);

  if (strict && !result.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
