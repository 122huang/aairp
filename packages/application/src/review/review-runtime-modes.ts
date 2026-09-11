import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import {
  resolveOpenRiskLlmMode,
  resolveOpenRiskModel,
  resolveOpenRiskTextProvider,
} from './open-risk-llm.gateway.js';
import { getEvidenceJudgmentRuntimeInfo } from '../evidence/evidence-judgment-llm.gateway.js';

/** Approved production-equivalent Open Risk mode (Legal GT calibrated stack). */
export const APPROVED_PRODUCTION_OPEN_RISK_MODE = 'stub' as const;

export const OPEN_RISK_PROMPT_VERSION = 'demo-open-risk-1.5.4';

/** Copy fusion then overall overlay. Code path, not a pack version. */
export const FUSION_MODE = 'copy_then_overall';

export type ReviewStack = 'production' | 'experimental';

export type ReviewRuntimeModes = {
  review_stack: ReviewStack;
  rule_version: string;
  playbook_version: string;
  open_risk_mode: 'live' | 'stub';
  open_risk_mode_source: 'AAIRP_OPEN_RISK_MODE' | 'default_stub_when_unset';
  open_risk_prompt_version: string;
  open_risk_provider: string | null;
  open_risk_model?: string;
  evidence_judgment_mode: 'live' | 'stub';
  fusion_mode: typeof FUSION_MODE;
};

export function getReviewRuntimeModes(): ReviewRuntimeModes {
  const openRiskMode = resolveOpenRiskLlmMode();
  const evidence = getEvidenceJudgmentRuntimeInfo();
  const explicit = process.env.AAIRP_OPEN_RISK_MODE?.trim();
  const provider = resolveOpenRiskTextProvider();
  return {
    review_stack: openRiskMode === 'live' ? 'experimental' : 'production',
    rule_version: DEMO_KNOWLEDGE_VERSIONS.rulePackVersion,
    playbook_version: DEMO_KNOWLEDGE_VERSIONS.playbookPackVersion,
    open_risk_mode: openRiskMode,
    open_risk_mode_source: explicit ? 'AAIRP_OPEN_RISK_MODE' : 'default_stub_when_unset',
    open_risk_prompt_version: OPEN_RISK_PROMPT_VERSION,
    open_risk_provider: provider ?? process.env.OPEN_RISK_LLM_PROVIDER?.trim().toLowerCase() ?? null,
    ...(openRiskMode === 'live' && provider
      ? { open_risk_model: resolveOpenRiskModel(provider) }
      : {}),
    evidence_judgment_mode: evidence.evidence_judgment_mode,
    fusion_mode: FUSION_MODE,
  };
}

export function assertProductionEquivalentRuntime(
  modes: Pick<ReviewRuntimeModes, 'open_risk_mode'> = getReviewRuntimeModes(),
): void {
  if (modes.open_risk_mode !== APPROVED_PRODUCTION_OPEN_RISK_MODE) {
    throw new Error(
      `production-equivalent review stack requires Open Risk ${APPROVED_PRODUCTION_OPEN_RISK_MODE}, got ${modes.open_risk_mode}`,
    );
  }
}
