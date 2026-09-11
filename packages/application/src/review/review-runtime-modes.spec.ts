import { afterEach, describe, expect, it } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { composeOverallDecision } from '../evidence/overall-decision.js';
import { composeClaimOpinions } from '../evidence/claim-opinion.compose.js';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { DecisionEngineService } from './decision-engine.service.js';
import { OpenRiskDiscoveryService } from './open-risk-discovery.service.js';
import { PlaybookEngineService } from './playbook-engine.service.js';
import { RuleEngineService } from './rule-engine.service.js';
import { resolveOpenRiskLlmMode } from './open-risk-llm.gateway.js';
import {
  APPROVED_PRODUCTION_OPEN_RISK_MODE,
  assertProductionEquivalentRuntime,
  getReviewRuntimeModes,
} from './review-runtime-modes.js';

const STAINLESS_COPY =
  'Stainless steel reversible rack.\nUse to steam, cook on 2 levels, or cook mains and sides at the same time.';

const stainlessContext: ReviewContext = {
  reviewId: 'rev_runtime_parity_ss',
  advertisementId: 'ad_runtime_parity_ss',
  contentHash: 'hash_ss',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'MY',
    platformId: 'META',
    categoryId: 'sa.other',
  },
  normalizedContent: { text: STAINLESS_COPY, imageUrls: [] },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: { adFormat: 'image' },
  tags: [],
  builtAt: '2026-09-11T00:00:00.000Z',
};

const previousEnv = { ...process.env };

afterEach(() => {
  process.env = { ...previousEnv };
});

describe('review runtime modes', () => {
  it('defaults Open Risk to stub even when a provider API key is present', () => {
    delete process.env.AAIRP_OPEN_RISK_MODE;
    process.env.DEEPSEEK_API_KEY = 'sk-present-does-not-enable-open-risk';
    process.env.OPEN_RISK_LLM_PROVIDER = 'deepseek';
    expect(resolveOpenRiskLlmMode()).toBe('stub');
    const modes = getReviewRuntimeModes();
    expect(modes.open_risk_mode).toBe(APPROVED_PRODUCTION_OPEN_RISK_MODE);
    expect(modes.review_stack).toBe('production');
    expect(() => assertProductionEquivalentRuntime(modes)).not.toThrow();
  });

  it('marks explicit live as experimental, not production-equivalent', () => {
    process.env.AAIRP_OPEN_RISK_MODE = 'live';
    process.env.OPEN_RISK_LLM_PROVIDER = 'deepseek';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const modes = getReviewRuntimeModes();
    expect(modes.open_risk_mode).toBe('live');
    expect(modes.review_stack).toBe('experimental');
    expect(modes.open_risk_model).toBeTruthy();
    expect(() => assertProductionEquivalentRuntime(modes)).toThrow(/Open Risk stub/);
  });
});

describe('MY stainless steel runtime regression', () => {
  it('production-equivalent stub does not apply Open Risk overlay; overall PASS + EECA INFO', async () => {
    delete process.env.AAIRP_OPEN_RISK_MODE;
    const rules = new RuleEngineService().evaluate(stainlessContext);
    const playbooks = new PlaybookEngineService().evaluate(stainlessContext, {
      priorRuleFindings: rules.findings,
    });
    const openRisk = await new OpenRiskDiscoveryService({
      llmGateway: {
        complete: async () => ({
          content: JSON.stringify({
            prompt_pack_version: 'demo-open-risk-1.5.4',
            findings: [
              {
                risk_type: 'combined-misleading-claim',
                description: 'canned stub must not attach to this copy',
                severity: 'MEDIUM',
                suggested_action: 'WARN',
                confidence: 0.72,
                evidence_spans: [{ field: 'text', start: 0, end: 17, text: 'Clinically proven' }],
              },
            ],
          }),
          model: 'stub',
        }),
      },
    }).discover(stainlessContext, {
      hasBlocker: rules.hasBlocker,
      ruleFindings: rules.findings,
      playbookFindings: playbooks.findings,
    });

    expect(rules.findings.map((f) => f.refId)).toEqual(['demo-my-eeca-coe-prerequisite']);
    expect(rules.findings[0]?.decision).toBe('INFO');
    expect(playbooks.findings).toHaveLength(0);
    expect(openRisk.findings).toHaveLength(0);

    const fused = new DecisionEngineService().fuseFromFindings({
      reviewId: stainlessContext.reviewId,
      countryId: 'MY',
      hasBlocker: rules.hasBlocker,
      ruleFindings: rules.findings,
      playbookFindings: playbooks.findings,
      llmFindings: openRisk.findings,
      visionFindings: [],
      consistencyFindings: [],
      caseFindings: [],
    });
    expect(fused.finalDecision).toBe('PASS');

    const reportFindings = rules.findings.map((f) => ({
      findingId: f.findingId,
      module: f.module,
      refId: f.refId,
      severity: f.severity,
      decision: f.decision,
      summary: f.summary,
      remediationType: f.remediationType,
    }));
    const opinions = composeClaimOpinions({ findings: reportFindings, links: [], poolFileCount: 0 });
    const overall = composeOverallDecision({
      copyDecision: fused.finalDecision,
      findings: reportFindings,
      opinions,
    });
    expect(overall.copy_decision).toBe('PASS');
    expect(overall.overall_decision).toBe('PASS');
    expect(opinions.every((o) => o.kind === 'copy_only')).toBe(true);
  });

  it('experimental live overlay may WARN; must not be treated as production-equivalent', async () => {
    process.env.AAIRP_OPEN_RISK_MODE = 'live';
    const rules = new RuleEngineService().evaluate(stainlessContext);
    const playbooks = new PlaybookEngineService().evaluate(stainlessContext, {
      priorRuleFindings: rules.findings,
    });
    const openRisk = await new OpenRiskDiscoveryService({
      llmGateway: {
        complete: async () => ({
          content: JSON.stringify({
            prompt_pack_version: 'demo-open-risk-1.5.4',
            findings: [
              {
                risk_type: 'material-claim',
                description: 'Stainless steel material selling point',
                severity: 'LOW',
                suggested_action: 'WARN',
                confidence: 0.7,
                evidence_spans: [{ field: 'text', start: 0, end: 15, text: 'Stainless steel' }],
              },
            ],
          }),
          model: 'experimental-mock',
        }),
      },
    }).discover(stainlessContext, {
      hasBlocker: rules.hasBlocker,
      ruleFindings: rules.findings,
      playbookFindings: playbooks.findings,
    });

    expect(openRisk.findings).toHaveLength(1);
    expect(openRisk.findings[0]?.refId).toBe('material-claim');
    expect(openRisk.findings[0]?.decision).toBe('WARN');

    const fused = new DecisionEngineService().fuseFromFindings({
      reviewId: stainlessContext.reviewId,
      countryId: 'MY',
      hasBlocker: rules.hasBlocker,
      ruleFindings: rules.findings,
      playbookFindings: playbooks.findings,
      llmFindings: openRisk.findings,
      visionFindings: [],
      consistencyFindings: [],
      caseFindings: [],
    });
    expect(fused.finalDecision).toBe('WARN');
    expect(() => assertProductionEquivalentRuntime(getReviewRuntimeModes())).toThrow();
  });
});
