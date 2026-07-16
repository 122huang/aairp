import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import {
  OpenRiskDiscoveryService,
  applyOpenRiskGuardrails,
  parseOpenRiskStubResponse,
  renderOpenRiskPrompt,
} from './open-risk-discovery.service.js';
import type { ILlmGateway } from './stub-llm.gateway.types.js';

const demoPromptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/open-risk.prompt.txt',
);
const demoStubPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/open-risk.stub.json',
);

const baseContext: ReviewContext = {
  reviewId: 'rev_test',
  advertisementId: 'ad_test',
  contentHash: 'hash123',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'META',
    categoryId: 'health.supplement',
  },
  normalizedContent: {
    text: 'Clinically proven to cure diabetes in 7 days. Buy now!',
    imageUrls: [],
  },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-06-26T10:05:00.000Z',
};

const priorWithoutBlocker = {
  hasBlocker: false,
  ruleFindings: [
    {
      refId: 'demo-sg-health-superlative',
      summary: 'Superlative claim',
      severity: 'MEDIUM',
      decision: 'WARN',
    },
  ],
  playbookFindings: [
    {
      refId: 'unsubstantiated-testimonial',
      summary: 'Testimonial guidance',
      decision: 'REVIEW',
    },
  ],
};

describe('OpenRiskDiscoveryService', () => {
  const fixedDate = new Date('2026-06-26T10:08:00.000Z');

  it('renders prompt template with context and prior findings', () => {
    const template = readFileSync(demoPromptPath, 'utf8');
    const prompt = renderOpenRiskPrompt(template, baseContext, priorWithoutBlocker);

    expect(prompt).toContain(baseContext.normalizedContent.text);
    expect(prompt).toContain('SG');
    expect(prompt).toContain('demo-sg-health-superlative:WARN:Superlative claim');
    expect(prompt).toContain('do NOT restate the SAME risk_type');
    expect(prompt).toContain('evidence_spans');
    expect(prompt).not.toContain('{case_precedents_summary}');
    expect(prompt).toContain('none');
  });

  it('renders case-grounded prompt placeholders when case context is present', () => {
    const template = readFileSync(demoPromptPath, 'utf8');
    const prompt = renderOpenRiskPrompt(template, baseContext, {
      ...priorWithoutBlocker,
      caseReviewContext: {
        caseIds: ['case_example_sg_health_reject'],
        precedentSummaries: [
          '- case_id=case_example_sg_health_reject; decision=REJECT; status=CONFIRMED; similarity=0.91; Remove cure claim',
        ],
        sharedRuleRefs: ['demo-sg-health-forbidden-claim'],
        regulationCitations: [
          {
            law_name: 'SG Health Products Act (Demo)',
            article: 'Section 7 — Prohibited claims',
            jurisdiction: 'SG',
          },
        ],
        humanOverrideNotes: [],
        coverageScore: 0.91,
        exactContentHashMatch: false,
        hasConfirmedExactMatch: false,
        coldStart: false,
      },
    });

    expect(prompt).toContain('case_example_sg_health_reject');
    expect(prompt).toContain('SG Health Products Act (Demo)');
    expect(prompt).toContain('cited_case_ids');
  });

  it('requires case or rule citations when case context precedents exist', () => {
    const prior = {
      hasBlocker: false,
      ruleFindings: [],
      playbookFindings: [],
      caseReviewContext: {
        caseIds: ['case_001'],
        precedentSummaries: ['- case_id=case_001; decision=WARN'],
        sharedRuleRefs: [],
        regulationCitations: [],
        humanOverrideNotes: [],
        coverageScore: 0.8,
        exactContentHashMatch: false,
        hasConfirmedExactMatch: false,
        coldStart: false,
      },
    };

    const filtered = applyOpenRiskGuardrails(
      [
        {
          module: 'LLM',
          findingId: 'lf_1',
          severity: 'MEDIUM',
          decision: 'WARN',
          refType: 'LLM_RISK',
          refId: 'speculative-risk',
          refVersionId: 'v1',
          summary: 'No citation',
          confidence: 0.7,
          evaluationDetail: {
            riskType: 'speculative-risk',
            suggestedAction: 'WARN',
          },
        },
      ],
      baseContext,
      prior,
    );

    expect(filtered).toEqual([]);
  });

  it('skips LLM when exact hash confirmed precedent flag is set', async () => {
    const gateway: ILlmGateway = { complete: vi.fn() };
    const service = new OpenRiskDiscoveryService({
      llmGateway: gateway,
      now: () => fixedDate,
    });

    const previousFlag = process.env.AAIRP_CASE_SKIP_LLM_ON_EXACT_HASH;
    const previousCaseFirst = process.env.AAIRP_CASE_FIRST_ENABLED;
    process.env.AAIRP_CASE_FIRST_ENABLED = 'true';
    process.env.AAIRP_CASE_SKIP_LLM_ON_EXACT_HASH = 'true';

    try {
      const result = await service.discover(baseContext, {
        hasBlocker: false,
        ruleFindings: [],
        playbookFindings: [],
        caseReviewContext: {
          caseIds: ['case_exact'],
          precedentSummaries: ['- case_id=case_exact; decision=REJECT; status=CONFIRMED'],
          sharedRuleRefs: [],
          regulationCitations: [],
          humanOverrideNotes: [],
          coverageScore: 1,
          exactContentHashMatch: true,
          hasConfirmedExactMatch: true,
          coldStart: false,
        },
      });

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('EXACT_HASH_PRECEDENT');
      expect(gateway.complete).not.toHaveBeenCalled();
    } finally {
      if (previousFlag === undefined) {
        delete process.env.AAIRP_CASE_SKIP_LLM_ON_EXACT_HASH;
      } else {
        process.env.AAIRP_CASE_SKIP_LLM_ON_EXACT_HASH = previousFlag;
      }
      if (previousCaseFirst === undefined) {
        delete process.env.AAIRP_CASE_FIRST_ENABLED;
      } else {
        process.env.AAIRP_CASE_FIRST_ENABLED = previousCaseFirst;
      }
    }
  });

  it('skips LLM when prior findings include a blocker', async () => {
    const gateway: ILlmGateway = { complete: vi.fn() };
    const service = new OpenRiskDiscoveryService({
      llmGateway: gateway,
      now: () => fixedDate,
    });

    const result = await service.discover(baseContext, {
      ...priorWithoutBlocker,
      hasBlocker: true,
    });

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe('HAS_BLOCKER');
    expect(result.findings).toEqual([]);
    expect(gateway.complete).not.toHaveBeenCalled();
  });

  it('calls stub LLM gateway and parses findings from stub JSON', async () => {
    const gateway: ILlmGateway = {
      complete: vi.fn().mockResolvedValue({ content: readFileSync(demoStubPath, 'utf8') }),
    };
    const service = new OpenRiskDiscoveryService({
      promptPath: demoPromptPath,
      llmGateway: gateway,
      now: () => fixedDate,
      createFindingId: () => '11111111-1111-1111-1111-111111111111',
    });

    const result = await service.discover(baseContext, priorWithoutBlocker);

    expect(gateway.complete).toHaveBeenCalledTimes(1);
    expect(result.skipped).toBe(false);
    expect(result.promptPackVersion).toBe('demo-open-risk-1.5.3');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      module: 'LLM',
      refId: 'combined-misleading-claim',
      decision: 'WARN',
      severity: 'MEDIUM',
      evaluationDetail: {
        suggestedAction: 'WARN',
        riskType: 'combined-misleading-claim',
      },
    });
  });

  it('discards findings that only repeat already reported module refs', async () => {
    const gateway: ILlmGateway = {
      complete: vi.fn().mockResolvedValue({ content: readFileSync(demoStubPath, 'utf8') }),
    };
    const service = new OpenRiskDiscoveryService({
      promptPath: demoPromptPath,
      llmGateway: gateway,
    });

    const result = await service.discover(baseContext, {
      hasBlocker: false,
      ruleFindings: [
        {
          refId: 'demo-sg-health-forbidden-claim',
          summary: 'Forbidden claim',
          severity: 'BLOCKER',
          decision: 'FAIL',
        },
      ],
      playbookFindings: [
        {
          refId: 'unsubstantiated-testimonial',
          summary: 'Testimonial guidance',
          decision: 'REVIEW',
        },
      ],
    });

    expect(result.findings).toEqual([]);
  });

  it('discards stub findings when evidence spans are not grounded in ad text', async () => {
    const gateway: ILlmGateway = {
      complete: vi.fn().mockResolvedValue({ content: readFileSync(demoStubPath, 'utf8') }),
    };
    const service = new OpenRiskDiscoveryService({
      promptPath: demoPromptPath,
      llmGateway: gateway,
    });

    const result = await service.discover(
      {
        ...baseContext,
        normalizedContent: {
          text: 'Daily vitamins for general wellness.',
          imageUrls: [],
        },
      },
      {
        hasBlocker: false,
        ruleFindings: [],
        playbookFindings: [],
      },
    );

    expect(result.findings).toEqual([]);
  });

  it('downgrades REJECT suggested_action to MANUAL_REVIEW', async () => {
    const adText = baseContext.normalizedContent.text;
    const service = new OpenRiskDiscoveryService({
      promptPath: demoPromptPath,
      llmGateway: {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            findings: [
              {
                risk_type: 'unsupported-reject',
                description: 'Should not reject alone',
                severity: 'HIGH',
                suggested_action: 'REJECT',
                confidence: 0.9,
                evidence_spans: [{ field: 'text', start: 0, end: adText.length, text: adText }],
              },
            ],
          }),
        }),
      },
    });

    const result = await service.discover(baseContext, priorWithoutBlocker);

    expect(result.findings[0]?.decision).toBe('REVIEW');
    expect(result.findings[0]?.evaluationDetail?.suggestedAction).toBe('MANUAL_REVIEW');
  });

  it('aligns with demo/open-risk.stub.json reference asset', () => {
    const asset = parseOpenRiskStubResponse(readFileSync(demoStubPath, 'utf8'));
    expect(asset.prompt_pack_version).toBe('demo-open-risk-1.5.3');
    expect(asset.findings[0]?.risk_type).toBe('combined-misleading-claim');
  });

  it('forces MANUAL_REVIEW for recall-only risk types even when LLM suggests WARN', async () => {
    const adText = baseContext.normalizedContent.text;
    const service = new OpenRiskDiscoveryService({
      promptPath: demoPromptPath,
      llmGateway: {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            findings: [
              {
                risk_type: 'sensitive-content-flag',
                description: '疑似涉及敏感话题，建议人工确认',
                severity: 'HIGH',
                suggested_action: 'WARN',
                confidence: 0.8,
                evidence_spans: [{ field: 'text', start: 0, end: adText.length, text: adText }],
                related_modules_checked: ['demo-cn-sensitive-content-manual-review'],
              },
              {
                risk_type: 'aana-children-code-risk',
                description: 'Suspected AANA 2.5 pester-power cue — human confirmation required',
                severity: 'MEDIUM',
                suggested_action: 'WARN',
                confidence: 0.7,
                evidence_spans: [{ field: 'text', start: 0, end: adText.length, text: adText }],
                related_modules_checked: ['demo-au-children-code-review'],
              },
            ],
          }),
        }),
      },
    });

    const result = await service.discover(baseContext, priorWithoutBlocker);

    expect(result.findings).toHaveLength(2);
    for (const finding of result.findings) {
      expect(finding.decision).toBe('REVIEW');
      expect(finding.evaluationDetail?.suggestedAction).toBe('MANUAL_REVIEW');
    }
  });

  it('renders ID/VN/PH mixed-language guidance in the prompt template', () => {
    const prompt = renderOpenRiskPrompt(
      readFileSync(demoPromptPath, 'utf8'),
      baseContext,
      priorWithoutBlocker,
    );

    expect(prompt).toContain('## ID / VN / PH guidance');
    expect(prompt).toContain('product-category-boundary');
    expect(prompt).toContain('vn-warn-tier');
    expect(prompt).toContain('do not inflate confidence to compensate');
    expect(prompt).toContain('Never translate evidence_spans');
  });

  it('includes AU/CN MANUAL_REVIEW recall taxonomy in the prompt template', () => {
    const prompt = readFileSync(demoPromptPath, 'utf8');

    expect(prompt).toContain('aana-children-code-risk');
    expect(prompt).toContain('sensitive-content-flag');
    expect(prompt).toContain('## AU / CN guidance');
    expect(prompt).toContain('demo-open-risk-1.5.3');
    expect(prompt).toContain('NEVER WARN');
  });
});
