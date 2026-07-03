import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveGoldenBenchmarkCasesPath(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  if (process.env.AAIRP_GOLDEN_CASES_PATH) {
    return process.env.AAIRP_GOLDEN_CASES_PATH;
  }
  return join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../scripts/golden-benchmark-v1-cases.json',
  );
}

export function resolveGoldenBenchmarkOutputDir(customDir?: string): string {
  if (customDir) {
    return customDir;
  }
  if (process.env.AAIRP_GOLDEN_OUTPUT_DIR) {
    return process.env.AAIRP_GOLDEN_OUTPUT_DIR;
  }
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../pilot/results');
}
