export type SemanticNumericAuthorityMode = 'off' | 'shadow' | 'on';

export const SEMANTIC_NUMERIC_AUTHORITY_ENV = 'AAIRP_SEMANTIC_NUMERIC_AUTHORITY';
export const SEMANTIC_NUMERIC_TIMEOUT_ENV = 'AAIRP_SEMANTIC_NUMERIC_TIMEOUT_MS';
export const SEMANTIC_NUMERIC_SHADOW_CAP_ENV = 'AAIRP_SEMANTIC_NUMERIC_SHADOW_MAX_PER_PROCESS';
export const SEMANTIC_NUMERIC_NORMALIZER_VERSION = 'p0.5e2-ontology-normalizer-1';

let numericShadowInvocationsThisProcess = 0;

export function resetNumericShadowCapCounter(): void {
  numericShadowInvocationsThisProcess = 0;
}

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

export function resolveNumericShadowMaxPerProcess(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env[SEMANTIC_NUMERIC_SHADOW_CAP_ENV] ?? '100');
  if (!Number.isFinite(raw) || raw < 0) {
    return 100;
  }
  return Math.floor(raw);
}

export function consumeNumericShadowCap(env: NodeJS.ProcessEnv = process.env): boolean {
  const max = resolveNumericShadowMaxPerProcess(env);
  if (numericShadowInvocationsThisProcess >= max) {
    return false;
  }
  numericShadowInvocationsThisProcess += 1;
  return true;
}
