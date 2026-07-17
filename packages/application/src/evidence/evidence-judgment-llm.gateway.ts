import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createResilientLlmGateway } from '../review/llm-gateway.utils.js';
import { StubLlmGateway } from '../review/stub-llm.gateway.js';
import type { ILlmGateway } from '../review/stub-llm.gateway.types.js';
import { OpenRiskLlmGateway, resolveOpenRiskLlmMode } from '../review/open-risk-llm.gateway.js';

const defaultStubPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/evidence-judgment.stub.json',
);

/**
 * Resolve evidence-judgment LLM mode.
 *
 * - Explicit `AAIRP_EVIDENCE_JUDGMENT_MODE=live|stub` wins.
 * - Otherwise inherits `AAIRP_OPEN_RISK_MODE` (same provider stack).
 *
 * Important: stub does NOT key off document IDs / PLACEHOLDER titles.
 * Stub always returns demo/evidence-judgment.stub.json (strong/sufficient).
 * A relevance=none result is therefore NOT explained by "stub default for unknown docs".
 */
export function resolveEvidenceJudgmentLlmMode(): 'live' | 'stub' {
  const raw = process.env.AAIRP_EVIDENCE_JUDGMENT_MODE?.trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw === 'stub') return 'stub';
  return resolveOpenRiskLlmMode();
}

export type EvidenceJudgmentRuntimeInfo = {
  evidence_judgment_mode: 'live' | 'stub';
  evidence_judgment_mode_source:
    | 'AAIRP_EVIDENCE_JUDGMENT_MODE'
    | 'inherited_AAIRP_OPEN_RISK_MODE';
  open_risk_mode: 'live' | 'stub';
  open_risk_provider: string | null;
  has_deepseek_api_key: boolean;
  /** True when live judgment can actually call a provider. */
  live_ready: boolean;
};

export function getEvidenceJudgmentRuntimeInfo(): EvidenceJudgmentRuntimeInfo {
  const explicit = process.env.AAIRP_EVIDENCE_JUDGMENT_MODE?.trim().toLowerCase();
  const evidenceMode = resolveEvidenceJudgmentLlmMode();
  const openRiskMode = resolveOpenRiskLlmMode();
  const provider = process.env.OPEN_RISK_LLM_PROVIDER?.trim().toLowerCase() || null;
  const hasDeepseek = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const hasOpenai = Boolean(process.env.OPENAI_API_KEY?.trim());
  const providerReady =
    (provider === 'deepseek' && hasDeepseek) ||
    (provider === 'anthropic' && hasAnthropic) ||
    (provider === 'openai' && hasOpenai) ||
    (!provider && (hasDeepseek || hasAnthropic || hasOpenai));

  return {
    evidence_judgment_mode: evidenceMode,
    evidence_judgment_mode_source:
      explicit === 'live' || explicit === 'stub'
        ? 'AAIRP_EVIDENCE_JUDGMENT_MODE'
        : 'inherited_AAIRP_OPEN_RISK_MODE',
    open_risk_mode: openRiskMode,
    open_risk_provider: provider,
    has_deepseek_api_key: hasDeepseek,
    live_ready: evidenceMode === 'live' && providerReady,
  };
}

export function createDefaultEvidenceJudgmentLlmGateway(options?: {
  stubResponsePath?: string;
  readTextFile?: (path: string) => string;
}): ILlmGateway {
  const readTextFile = options?.readTextFile ?? ((path: string) => readFileSync(path, 'utf8'));
  const stubResponsePath = options?.stubResponsePath ?? defaultStubPath;
  const inner: ILlmGateway =
    resolveEvidenceJudgmentLlmMode() === 'live'
      ? new OpenRiskLlmGateway()
      : new StubLlmGateway({ responsePath: stubResponsePath, readTextFile });

  return createResilientLlmGateway(inner, {
    timeoutMs: Number(process.env.EVIDENCE_JUDGMENT_TIMEOUT_MS ?? 45_000),
    maxRetries: 1,
  });
}
