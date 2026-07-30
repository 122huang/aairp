/**
 * Automated accuracy QA smoke — no Postgres / review-app UI required.
 * Run: node scripts/qa-accuracy-smoke.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function run(label, cmd) {
  console.log(`\n▶ ${label}`);
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit', shell: true });
    return { label, ok: true };
  } catch {
    return { label, ok: false };
  }
}

const steps = [
  run(
    'Evidence unit tests (SKU + claim-relevant retrieval)',
    'pnpm --filter @aairp/application exec vitest run src/evidence/evidence-text-retrieval.spec.ts src/evidence/evidence-judgment.spec.ts --reporter=dot',
  ),
  run('Evidence judgment eval fixture (20 cases)', 'pnpm --filter @aairp/application eval:evidence-judgment'),
  run(
    'Finding merge tests (B2 claim_anchor)',
    'pnpm --filter @aairp/review-app exec vitest run src/lib/finding-merge.spec.ts --reporter=dot',
  ),
];

let evalSummary = 'not run';
try {
  const report = JSON.parse(readFileSync(join(root, 'reports/evidence-judgment-eval.json'), 'utf8'));
  evalSummary = `${report.passed ?? report.summary?.passed ?? '?'}/${report.total ?? report.summary?.total ?? '?'} evidence-judgment cases`;
} catch {
  /* optional */
}

const allOk = steps.every((s) => s.ok);
const lines = [
  `# Accuracy QA smoke — ${new Date().toISOString()}`,
  '',
  `**Overall:** ${allOk ? 'PASS' : 'FAIL'}`,
  '',
  '| Step | Result |',
  '|------|--------|',
  ...steps.map((s) => `| ${s.label} | ${s.ok ? 'PASS' : 'FAIL'} |`),
  '',
  `Evidence judgment eval: ${evalSummary}`,
  '',
  'Manual UI QA (SKU field, long evidence upload, evidence card): see docs/qa/review-app-accuracy-qa.md — requires `pnpm dev:api` + Postgres.',
  '',
];

const outPath = join(root, 'reports/qa-accuracy-smoke-latest.md');
writeFileSync(outPath, lines.join('\n'));
console.log(`\nReport: ${outPath}`);
console.log(allOk ? '\n✓ Automated smoke PASS' : '\n✗ Automated smoke FAIL');
process.exit(allOk ? 0 : 1);
