export type SemanticNumericAuthorityMode = 'off' | 'shadow' | 'on';

export const SEMANTIC_NUMERIC_AUTHORITY_ENV = 'AAIRP_SEMANTIC_NUMERIC_AUTHORITY';
export const SEMANTIC_NUMERIC_TIMEOUT_ENV = 'AAIRP_SEMANTIC_NUMERIC_TIMEOUT_MS';
export const SEMANTIC_NUMERIC_NORMALIZER_VERSION = 'p0.5e2-ontology-normalizer-1';

export function resolveSemanticNumericAuthorityMode(
  env: NodeJS.ProcessEnv = process.env,
): SemanticNumericAuthorityMode {
  const raw = env[SEMANTIC_NUMERIC_AUTHORITY_ENV]?.trim().toLowerCase();
  if (raw === 'shadow' || raw === 'on') {
    return raw;
  }
  return 'off';
}

export function resolveSemanticNumericTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env[SEMANTIC_NUMERIC_TIMEOUT_ENV] ?? '20000');
  if (!Number.isFinite(raw) || raw <= 0) {
    return 20_000;
  }
  return Math.min(45_000, Math.floor(raw));
}
