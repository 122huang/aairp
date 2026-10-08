export type SemanticShadowMode = 'off' | 'sampled' | 'on';

export const SEMANTIC_SHADOW_MODE_ENV = 'AAIRP_SEMANTIC_SHADOW_MODE';
export const SEMANTIC_SHADOW_SAMPLE_RATE_ENV = 'AAIRP_SEMANTIC_SHADOW_SAMPLE_RATE';
export const SEMANTIC_SHADOW_DATA_APPROVED_ENV = 'AAIRP_SEMANTIC_SHADOW_DATA_APPROVED';
export const SEMANTIC_SHADOW_NORMALIZER_VERSION = 'p0.5e2-ontology-normalizer-1';

let sampledThisProcess = 0;

export function resetSemanticShadowSampleCounter(): void {
  sampledThisProcess = 0;
}

export function resolveSemanticShadowMode(
  env: NodeJS.ProcessEnv = process.env,
): SemanticShadowMode {
  const raw = env[SEMANTIC_SHADOW_MODE_ENV]?.trim().toLowerCase();
  if (raw === 'sampled' || raw === 'on') {
    return raw;
  }
  return 'off';
}

export function semanticShadowDataApproved(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[SEMANTIC_SHADOW_DATA_APPROVED_ENV]?.trim().toLowerCase() === 'true';
}

export function resolveSemanticShadowSampleRate(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env[SEMANTIC_SHADOW_SAMPLE_RATE_ENV] ?? '0.1');
  if (!Number.isFinite(raw)) {
    return 0.1;
  }
  return Math.min(1, Math.max(0, raw));
}

export function resolveSemanticShadowMaxPerProcess(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.AAIRP_SEMANTIC_SHADOW_MAX_PER_PROCESS ?? '100');
  if (!Number.isFinite(raw) || raw < 0) {
    return 100;
  }
  return Math.floor(raw);
}

export function shouldInvokeSemanticShadow(
  env: NodeJS.ProcessEnv = process.env,
  random: () => number = Math.random,
): boolean {
  const mode = resolveSemanticShadowMode(env);
  if (mode === 'off') {
    return false;
  }
  const max = resolveSemanticShadowMaxPerProcess(env);
  if (sampledThisProcess >= max) {
    return false;
  }
  if (mode === 'on') {
    sampledThisProcess += 1;
    return true;
  }
  if (random() < resolveSemanticShadowSampleRate(env)) {
    sampledThisProcess += 1;
    return true;
  }
  return false;
}

export function keyPresent(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.DEEPSEEK_API_KEY?.trim());
}
