/**
 * @deprecated Use `pnpm eval:golden` instead.
 * Thin wrapper kept for existing docs/scripts.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = process.argv[2] ?? 'pilot/results/golden-benchmark-v1-offline.json';
const args = ['eval:golden', '--', '--output', outPath];

const result = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
