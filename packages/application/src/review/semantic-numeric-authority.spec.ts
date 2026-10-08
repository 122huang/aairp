import { afterEach, describe, expect, it } from 'vitest';
import { supportsEvidenceAttachment, type ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { DecisionEngineService } from './decision-engine.service.js';
import { OpenRiskDiscoveryService } from './open-risk-discovery.service.js';
import { PlaybookEngineService } from './playbook-engine.service.js';
import { ReviewPipelineService } from './review-pipeline.service.js';
import { ReviewReportService } from './review-report.service.js';
import { RuleEngineService } from './rule-engine.service.js';
import {
  resetNumericShadowCapCounter,
  resolveSemanticNumericAuthorityMode,
  resolveSemanticNumericTimeoutMs,
} from './semantic-numeric-authority-mode.js';
import {
  NUMERIC_SHADOW_EVENT_TYPE,
  SemanticNumericAuthorityService,
} from './semantic-numeric-authority.service.js';
import { extractAnchors, normalize } from './semantic-shadow-engine.js';
import {
  applyNumericAuthorityGate,
  evaluateNumericEligibility,
} from './semantic-numeric-authority.js';
import { getReviewRuntimeModes } from './review-runtime-modes.js';

const previousEnv = { ...process.env };

afterEach(() => {
  process.env = { ...previousEnv };
  resetNumericShadowCapCounter();
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const sgContext = (text: string): ReviewContext => ({
  reviewId: 'rev_p05h',
  advertisementId: 'ad_p05h',
  contentHash: 'h',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'SHOPEE',
    categoryId: 'sa.other',
  },
  normalizedContent: { text, imageUrls: [] },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-09-28T00:00:00.000Z',
});

const HISTORICAL = 'Healthy cooking made simple\nSteam cooking retains up to 90% of nutrients*.';
const FRESH_VITAMIN = 'Basket cooking keeps at most 61 percent of vitamins after a short steam cycle.';
const FRESH_HOLD = 'This steamer preserves 61% of minerals when you cook on the rack.';
const DISCOUNT = 'Weekend promo: 20% off the listed price.';
const YEAR = 'Trusted since 2019 for family kitchens.';
const SKU = 'Order SKU-2190 or model KX90 today.';
const HEALTH_ONLY = 'Certified ranking and endorsed status for a healthier lifestyle.';

function nutrientProposal(span: string, value: number) {
  return {
    primary_grounding_span: span,
    material: true,
    consumer_meaning: 'upper bound nutrient retention',
    metric: 'nutrient',
    relation: 'upper_bound',
    predicate: 'nutrient retention',
    quantity_value: value,
    unit: 'percent',
  };
}

describe('semantic numeric authority mode', () => {
  it('defaults off and does not follow API key presence', () => {
    delete process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY;
    process.env.DEEPSEEK_API_KEY = 'sk-present';
    expect(resolveSemanticNumericAuthorityMode()).toBe('off');
    expect(getReviewRuntimeModes().semantic_numeric_authority).toBe('off');
    expect(getReviewRuntimeModes().open_risk_mode).toBe('stub');
  });

  it('bounds timeout', () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_TIMEOUT_MS = '20000';
    expect(resolveSemanticNumericTimeoutMs()).toBe(20_000);
  });
});

describe('numeric authority gate', () => {
  it('passes quantified nutrient retention', () => {
    const copy = FRESH_VITAMIN;
    const proposal = nutrientProposal('keeps at most 61 percent of vitamins', 61);
    const anchors = extractAnchors(copy);
    const normalized = normalize(copy, anchors, proposal);
    const gate = applyNumericAuthorityGate({ copy, anchors, proposal, normalized });
    expect(gate.pass).toBe(true);
    if (gate.pass) {
      expect(gate.mapping.ruleId).toBe('demo-apac-sa-performance-claim');
      expect(gate.mapping.decision).toBe('WARN');
      expect(gate.mapping.remediationType).toBe('EVIDENCE_SUPPLEMENT');
    }
  });

  it('abstains on relation conflict', () => {
    const copy = 'Steam cooking retains up to 40% of nutrients.';
    const proposal = {
      ...nutrientProposal('retains up to 40% of nutrients', 99),
      quantity_value: 99,
    };
    const anchors = extractAnchors(copy);
    const normalized = normalize(copy, anchors, proposal);
    const gate = applyNumericAuthorityGate({ copy, anchors, proposal, normalized });
    expect(gate.pass).toBe(false);
    if (!gate.pass) {
      expect(gate.reason).toBe('CONSISTENCY_CONFLICT');
    }
  });
});

describe('semantic numeric authority service A–K', () => {
  it('A. Rule hit numeric claim does not duplicate', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const context = sgContext(HISTORICAL);
    const rules = new RuleEngineService().evaluate(context);
    expect(rules.findings.some((f) => f.refId === 'demo-apac-sa-performance-claim')).toBe(true);
    const events: Record<string, unknown>[] = [];
    const service = new SemanticNumericAuthorityService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => ({
        propositions: [nutrientProposal('retains up to 90% of nutrients', 90)],
      }),
    });
    const applied = await service.apply(context, {
      ruleFindings: rules.findings,
      playbookFindings: [],
    });
    expect(applied.findings).toHaveLength(0);
    expect(applied.event.final_shadow_status).toBe('deduplicated');
    expect(applied.event.source_provenance).toBe('RULE+SEMANTIC_NUMERIC');
  });

  it('B. Rule miss + valid semantic numeric claim yields supplemental Finding', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const context = sgContext(FRESH_VITAMIN);
    const rules = new RuleEngineService().evaluate(context);
    expect(rules.findings.some((f) => f.refId === 'demo-apac-sa-performance-claim')).toBe(false);
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => ({
        propositions: [nutrientProposal('keeps at most 61 percent of vitamins', 61)],
      }),
    });
    const applied = await service.apply(context, {
      ruleFindings: rules.findings,
      playbookFindings: [],
    });
    expect(applied.findings).toHaveLength(1);
    expect(applied.findings[0]?.refId).toBe('demo-apac-sa-performance-claim');
    expect(applied.findings[0]?.decision).toBe('WARN');
    expect(applied.findings[0]?.findingId.startsWith('rf_semnum_')).toBe(true);
    expect(applied.event.final_shadow_status).toBe('authoritative_supplemental');
  });

  it('C. discount percentage is not a material Finding', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const context = sgContext(DISCOUNT);
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => ({
        propositions: [
          {
            primary_grounding_span: '20% off',
            material: true,
            quantity_value: 20,
            relation: 'exact',
          },
        ],
      }),
    });
    const applied = await service.apply(context, { ruleFindings: [], playbookFindings: [] });
    expect(applied.findings).toHaveLength(0);
    expect(applied.event.authority_gate_fail_reasons).toEqual(['NON_MATERIAL_NUMBER']);
  });

  it('D. date/year is not a Finding', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const context = sgContext(YEAR);
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => ({
        propositions: [{ primary_grounding_span: '2019', material: true, quantity_value: 2019 }],
      }),
    });
    const applied = await service.apply(context, { ruleFindings: [], playbookFindings: [] });
    expect(applied.findings).toHaveLength(0);
  });

  it('E. SKU/model numbers are not a Finding', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const context = sgContext(SKU);
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => ({
        propositions: [{ primary_grounding_span: 'SKU-2190', material: true }],
      }),
    });
    const applied = await service.apply(context, { ruleFindings: [], playbookFindings: [] });
    expect(applied.findings).toHaveLength(0);
  });

  it('F. numeric relation conflict abstains', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const copy = 'Steam cooking retains up to 40% of nutrients.';
    const context = sgContext(copy);
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => ({
        propositions: [{ ...nutrientProposal('retains up to 40% of nutrients', 99), quantity_value: 99 }],
      }),
    });
    const applied = await service.apply(context, { ruleFindings: [], playbookFindings: [] });
    expect(applied.findings).toHaveLength(0);
    expect(applied.event.authority_gate_fail_reasons).toEqual(['CONSISTENCY_CONFLICT']);
  });

  it('G. DeepSeek unavailable leaves Rule result unchanged', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const context = sgContext(FRESH_VITAMIN);
    const rules = new RuleEngineService().evaluate(context);
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => ({ propositions: [], error: 'provider' }),
    });
    const applied = await service.apply(context, {
      ruleFindings: rules.findings,
      playbookFindings: [],
    });
    expect(applied.findings).toHaveLength(0);
    expect(applied.event.authority_gate_pass).toBe(false);
  });

  it('H. invalid model output leaves Rule result unchanged', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => ({ propositions: [{ not: 'schema' }] }),
    });
    const applied = await service.apply(sgContext(FRESH_VITAMIN), {
      ruleFindings: [],
      playbookFindings: [],
    });
    expect(applied.findings).toHaveLength(0);
  });

  it('I. valid quantified substantiable claim is evidence-attachable', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => ({
        propositions: [nutrientProposal('keeps at most 61 percent of vitamins', 61)],
      }),
    });
    const applied = await service.apply(sgContext(FRESH_VITAMIN), {
      ruleFindings: [],
      playbookFindings: [],
    });
    const finding = applied.findings[0];
    expect(finding?.remediationType).toBe('EVIDENCE_SUPPLEMENT');
    expect(supportsEvidenceAttachment(finding?.remediationType, finding?.decision)).toBe(true);
    expect(applied.event.would_enter_evidence_flow).toBe(true);
  });

  it('J. general non-numeric Semantic proposal remains shadow only', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => ({
        propositions: [
          {
            primary_grounding_span: 'Certified ranking and endorsed status',
            material: true,
            predicate: 'endorsement',
          },
        ],
      }),
    });
    const applied = await service.apply(sgContext(HEALTH_ONLY), {
      ruleFindings: [],
      playbookFindings: [],
    });
    expect(applied.findings).toHaveLength(0);
    expect(applied.event.final_shadow_status).toBe('ineligible');
  });

  it('K. Open Risk remains stub while numeric authority is on', () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    delete process.env.AAIRP_OPEN_RISK_MODE;
    const modes = getReviewRuntimeModes();
    expect(modes.open_risk_mode).toBe('stub');
    expect(modes.semantic_numeric_authority).toBe('on');
  });

  it('shadow mode never emits a Finding', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const events: Record<string, unknown>[] = [];
    const service = new SemanticNumericAuthorityService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => ({
        propositions: [nutrientProposal('keeps at most 61 percent of vitamins', 61)],
      }),
    });
    service.scheduleShadow(sgContext(FRESH_VITAMIN), {
      ruleFindings: [],
      playbookFindings: [],
    });
    await wait(50);
    expect(events[0]?.would_be_supplemental).toBe(true);
    expect(events[0]?.would_authorize_numeric_finding).toBe(true);
    expect(events[0]?.final_shadow_status).toBe('would_authorize');
  });

  it('fresh semantically equivalent wording recovers without a phrase-specific rule', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const context = sgContext(FRESH_HOLD);
    expect(
      new RuleEngineService()
        .evaluate(context)
        .findings.some((f) => f.refId === 'demo-apac-sa-performance-claim'),
    ).toBe(false);
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => ({
        propositions: [nutrientProposal('preserves 61% of minerals', 61)],
      }),
    });
    const applied = await service.apply(context, { ruleFindings: [], playbookFindings: [] });
    expect(applied.findings).toHaveLength(1);
  });

  it('does not log API keys or reasoning', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-secret-key';
    const events: Record<string, unknown>[] = [];
    const service = new SemanticNumericAuthorityService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => ({ propositions: [], error: 'provider' }),
    });
    await service.apply(sgContext(FRESH_VITAMIN), { ruleFindings: [], playbookFindings: [] });
    expect(JSON.stringify(events)).not.toMatch(/sk-secret-key/);
    expect(JSON.stringify(events)).not.toMatch(/reasoning/i);
  });
});

describe('pipeline numeric authority integration', () => {
  it('production parity when off: Rule miss stays PASS', async () => {
    delete process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY;
    const pipeline = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService(),
      decisionEngineService: new DecisionEngineService(),
      reviewReportService: new ReviewReportService(),
      semanticNumericAuthorityService: {
        scheduleShadow() {
          throw new Error('must not schedule when off');
        },
        applyAuthoritative: async () => {
          throw new Error('must not invoke when off');
        },
      } as never,
    });
    const result = await pipeline.runThroughDecision(sgContext(FRESH_VITAMIN));
    expect(result.decision.finalDecision).not.toBe('WARN');
    expect(result.ruleResult.findings.some((f) => f.refId === 'demo-apac-sa-performance-claim')).toBe(
      false,
    );
    expect(result.openRiskResult.findings).toHaveLength(0);
  });

  it('on: Rule miss recovers WARN via supplemental Finding', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const pipeline = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService(),
      decisionEngineService: new DecisionEngineService(),
      reviewReportService: new ReviewReportService(),
      semanticNumericAuthorityService: new SemanticNumericAuthorityService({
        sink: () => undefined,
        gateway: async () => ({
          propositions: [nutrientProposal('keeps at most 61 percent of vitamins', 61)],
        }),
      }),
    });
    const result = await pipeline.runThroughDecision(sgContext(FRESH_VITAMIN));
    expect(result.ruleResult.findings.filter((f) => f.refId === 'demo-apac-sa-performance-claim')).toHaveLength(
      1,
    );
    expect(result.decision.finalDecision).toBe('WARN');
    expect(result.openRiskResult.findings).toHaveLength(0);
  });

  it('timeout fail-open keeps existing Rule result', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'on';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    process.env.AAIRP_SEMANTIC_NUMERIC_TIMEOUT_MS = '20';
    const pipeline = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService(),
      decisionEngineService: new DecisionEngineService(),
      reviewReportService: new ReviewReportService(),
      semanticNumericAuthorityService: new SemanticNumericAuthorityService({
        sink: () => undefined,
        gateway: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return { propositions: [nutrientProposal('keeps at most 61 percent of vitamins', 61)] };
        },
      }),
    });
    const result = await pipeline.runThroughDecision(sgContext(FRESH_VITAMIN));
    expect(result.ruleResult.findings.some((f) => f.findingId.startsWith('rf_semnum_'))).toBe(false);
  });
});

describe('P0.5G.1 numeric shadow runtime safety', () => {
  it('eligibility: digit/percent copy is eligible; written-only comparative is a recall limitation', () => {
    const eligible = evaluateNumericEligibility(extractAnchors(FRESH_VITAMIN));
    expect(eligible.eligible).toBe(true);
    const writtenOnly = evaluateNumericEligibility(extractAnchors('Cooks twice as fast with one third less oil.'));
    expect(writtenOnly.eligible).toBe(false);
    expect(writtenOnly.reason).toBe('NO_NUMERIC_STRUCTURE_SIGNAL');
  });

  it('A. off → provider not called', async () => {
    delete process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY;
    let called = 0;
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => {
        called += 1;
        return { propositions: [] };
      },
    });
    service.scheduleShadow(sgContext(FRESH_VITAMIN), { ruleFindings: [], playbookFindings: [] });
    const applied = await service.applyAuthoritative(sgContext(FRESH_VITAMIN), {
      ruleFindings: [],
      playbookFindings: [],
    });
    await wait(20);
    expect(called).toBe(0);
    expect(applied.findings).toHaveLength(0);
  });

  it('B/D. shadow eligible schedules provider without awaiting', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    let finished = 0;
    const events: Record<string, unknown>[] = [];
    const service = new SemanticNumericAuthorityService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => {
        await wait(400);
        finished += 1;
        return { propositions: [nutrientProposal('keeps at most 61 percent of vitamins', 61)] };
      },
    });
    const started = Date.now();
    service.scheduleShadow(sgContext(FRESH_VITAMIN), { ruleFindings: [], playbookFindings: [] });
    expect(Date.now() - started).toBeLessThan(80);
    expect(finished).toBe(0);
    await wait(500);
    expect(finished).toBe(1);
    expect(events.some((event) => event.event_type === NUMERIC_SHADOW_EVENT_TYPE)).toBe(true);
  });

  it('C. shadow ineligible does not call provider', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    let called = 0;
    const events: Record<string, unknown>[] = [];
    const service = new SemanticNumericAuthorityService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => {
        called += 1;
        return { propositions: [] };
      },
    });
    service.scheduleShadow(sgContext('Stainless steel reversible rack for family kitchens.'), {
      ruleFindings: [],
      playbookFindings: [],
    });
    await wait(40);
    expect(called).toBe(0);
    expect(events[0]?.final_shadow_status).toBe('ineligible');
  });

  it('E. shadow provider throw does not reject the caller', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const service = new SemanticNumericAuthorityService({
      sink: () => undefined,
      gateway: async () => {
        throw new Error('provider boom');
      },
    });
    expect(() =>
      service.scheduleShadow(sgContext(FRESH_VITAMIN), { ruleFindings: [], playbookFindings: [] }),
    ).not.toThrow();
    await wait(40);
  });

  it('F. shadow timeout does not attach findings', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    process.env.AAIRP_SEMANTIC_NUMERIC_TIMEOUT_MS = '20';
    const events: Record<string, unknown>[] = [];
    const service = new SemanticNumericAuthorityService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => {
        await wait(200);
        return { propositions: [nutrientProposal('keeps at most 61 percent of vitamins', 61)] };
      },
    });
    service.scheduleShadow(sgContext(FRESH_VITAMIN), { ruleFindings: [], playbookFindings: [] });
    await wait(80);
    expect(events.some((event) => event.final_shadow_status === 'shadow_timeout')).toBe(true);
  });

  it('G. cap reached skips provider', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    process.env.AAIRP_SEMANTIC_NUMERIC_SHADOW_MAX_PER_PROCESS = '1';
    let called = 0;
    const events: Record<string, unknown>[] = [];
    const service = new SemanticNumericAuthorityService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => {
        called += 1;
        return { propositions: [nutrientProposal('keeps at most 61 percent of vitamins', 61)] };
      },
    });
    service.scheduleShadow(sgContext(FRESH_VITAMIN), { ruleFindings: [], playbookFindings: [] });
    await wait(40);
    service.scheduleShadow(sgContext(FRESH_HOLD), { ruleFindings: [], playbookFindings: [] });
    await wait(40);
    expect(called).toBe(1);
    expect(events.some((event) => event.final_shadow_status === 'shadow_cap_reached')).toBe(true);
  });

  it('H/I. shadow gate pass logs WOULD_AUTHORIZE and evidence handoff without Finding', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const events: Record<string, unknown>[] = [];
    const service = new SemanticNumericAuthorityService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => ({
        propositions: [nutrientProposal('keeps at most 61 percent of vitamins', 61)],
      }),
    });
    service.scheduleShadow(sgContext(FRESH_VITAMIN), { ruleFindings: [], playbookFindings: [] });
    await wait(40);
    expect(events[0]?.would_authorize_numeric_finding).toBe(true);
    expect(events[0]?.would_enter_evidence_flow).toBe(true);
    expect(events[0]?.would_be_supplemental).toBe(true);
    expect(events[0]?.final_shadow_status).toBe('would_authorize');
  });

  it('J. shadow Rule duplicate logs RULE+SEMANTIC_NUMERIC and is not supplemental', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const events: Record<string, unknown>[] = [];
    const context = sgContext(HISTORICAL);
    const rules = new RuleEngineService().evaluate(context);
    const service = new SemanticNumericAuthorityService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => ({
        propositions: [nutrientProposal('retains up to 90% of nutrients', 90)],
      }),
    });
    service.scheduleShadow(context, { ruleFindings: rules.findings, playbookFindings: [] });
    await wait(40);
    expect(events[0]?.source_provenance).toBe('RULE+SEMANTIC_NUMERIC');
    expect(events[0]?.would_authorize_numeric_finding).toBe(true);
    expect(events[0]?.would_be_supplemental).toBe(false);
    expect(events[0]?.would_enter_evidence_flow).toBe(false);
  });

  it('K/L/N. pipeline shadow 5s provider does not delay Decision; no Finding', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const pipeline = new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService(),
      decisionEngineService: new DecisionEngineService(),
      reviewReportService: new ReviewReportService(),
      semanticNumericAuthorityService: new SemanticNumericAuthorityService({
        sink: () => undefined,
        gateway: async () => {
          await wait(5000);
          return { propositions: [nutrientProposal('keeps at most 61 percent of vitamins', 61)] };
        },
      }),
    });
    const started = Date.now();
    const result = await pipeline.runThroughDecision(sgContext(FRESH_VITAMIN));
    expect(Date.now() - started).toBeLessThan(500);
    expect(result.decision.finalDecision).not.toBe('WARN');
    expect(result.ruleResult.findings.some((f) => f.findingId.startsWith('rf_semnum_'))).toBe(false);
    expect(result.openRiskResult.findings).toHaveLength(0);
  });

  it('M. Open Risk remains stub while numeric shadow is on', () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    delete process.env.AAIRP_OPEN_RISK_MODE;
    expect(getReviewRuntimeModes().open_risk_mode).toBe('stub');
    expect(getReviewRuntimeModes().semantic_numeric_authority).toBe('shadow');
    expect(getReviewRuntimeModes().semantic_shadow_mode).toBe('off');
  });

  it('O. structured shadow log includes event_type', async () => {
    process.env.AAIRP_SEMANTIC_NUMERIC_AUTHORITY = 'shadow';
    process.env.AAIRP_SEMANTIC_SHADOW_DATA_APPROVED = 'true';
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    const events: Record<string, unknown>[] = [];
    const service = new SemanticNumericAuthorityService({
      sink: (event) => {
        events.push(event);
      },
      gateway: async () => ({ propositions: [], error: 'provider' }),
    });
    service.scheduleShadow(sgContext(FRESH_VITAMIN), { ruleFindings: [], playbookFindings: [] });
    await wait(40);
    expect(events[0]?.event_type).toBe('semantic_numeric_shadow');
    expect(JSON.stringify(events)).not.toMatch(/sk-test/);
  });
});
