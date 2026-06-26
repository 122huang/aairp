import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(fileURLToPath(import.meta.url));

/** Monorepo root (packages/application/src/case → ../../../..). */
export function resolveRepoRoot(): string {
  return join(packageDir, '../../../..');
}

export function resolveCaseLibraryRoot(rootOverride?: string): string {
  const fromEnv = process.env.AAIRP_CASE_LIBRARY_PATH;
  if (rootOverride) {
    return rootOverride;
  }
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.startsWith('/') || /^[A-Za-z]:/.test(fromEnv)
      ? fromEnv
      : join(resolveRepoRoot(), fromEnv);
  }
  return join(resolveRepoRoot(), 'case-library');
}

export function isCaseLibraryEnabled(): boolean {
  const flag = process.env.AAIRP_CASE_LIBRARY_ENABLED;
  if (flag === undefined) {
    return true;
  }
  return flag !== '0' && flag.toLowerCase() !== 'false';
}

export type CaseStorageMode = 'json' | 'kos' | 'dual';

export function resolveCaseStorageMode(): CaseStorageMode {
  const raw = process.env.AAIRP_CASE_STORAGE?.toLowerCase();
  if (raw === 'kos' || raw === 'dual') {
    return raw;
  }
  return 'json';
}

export const CASE_SCHEMA_VERSION_FILE = 'case.schema.version';
