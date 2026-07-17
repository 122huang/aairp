import { join } from 'node:path';
import { resolveRepoRoot } from '../case/case-paths.js';

/** Root directory for finding-attached evidence (JSON store + uploaded files). */
export function resolveEvidenceLibraryRoot(): string {
  const override = process.env.AAIRP_EVIDENCE_LIBRARY_ROOT?.trim();
  if (override) {
    return override.startsWith('/') || /^[A-Za-z]:/.test(override)
      ? override
      : join(resolveRepoRoot(), override);
  }
  return join(resolveRepoRoot(), 'data', 'finding-evidence');
}
