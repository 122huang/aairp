import { describe, expect, it, afterEach } from 'vitest';
import type { EvidenceJudgmentContext, EvidenceRecord } from '@aairp/shared-kernel';
import {
  getEvidenceJudgmentRuntimeInfo,
  resolveEvidenceJudgmentLlmMode,
} from './evidence-judgment-llm.gateway.js';
import { EvidenceJudgmentService } from './evidence-judgment.service.js';
import type { IEvidenceStore } from '@aairp/shared-kernel';

const originalEvidenceMode = process.env.AAIRP_EVIDENCE_JUDGMENT_MODE;
const originalOpenRiskMode = process.env.AAIRP_OPEN_RISK_MODE;

afterEach(() => {
  if (originalEvidenceMode === undefined) delete process.env.AAIRP_EVIDENCE_JUDGMENT_MODE;
  else process.env.AAIRP_EVIDENCE_JUDGMENT_MODE = originalEvidenceMode;
  if (originalOpenRiskMode === undefined) delete process.env.AAIRP_OPEN_RISK_MODE;
  else process.env.AAIRP_OPEN_RISK_MODE = originalOpenRiskMode;
});

describe('resolveEvidenceJudgmentLlmMode', () => {
  it('explicit live wins', () => {
    process.env.AAIRP_EVIDENCE_JUDGMENT_MODE = 'live';
    process.env.AAIRP_OPEN_RISK_MODE = 'stub';
    expect(resolveEvidenceJudgmentLlmMode()).toBe('live');
  });

  it('explicit stub wins even when open-risk is live', () => {
    process.env.AAIRP_EVIDENCE_JUDGMENT_MODE = 'stub';
    process.env.AAIRP_OPEN_RISK_MODE = 'live';
    expect(resolveEvidenceJudgmentLlmMode()).toBe('stub');
  });

  it('does not inherit open-risk mode when unset (defaults to stub)', () => {
    delete process.env.AAIRP_EVIDENCE_JUDGMENT_MODE;
    process.env.AAIRP_OPEN_RISK_MODE = 'live';
    expect(resolveEvidenceJudgmentLlmMode()).toBe('stub');
    const info = getEvidenceJudgmentRuntimeInfo();
    expect(info.evidence_judgment_mode).toBe('stub');
    expect(info.evidence_judgment_mode_source).toBe('default_stub_when_unset');
  });

  it('runtime info reports explicit source when set', () => {
    process.env.AAIRP_EVIDENCE_JUDGMENT_MODE = 'live';
    process.env.AAIRP_OPEN_RISK_MODE = 'stub';
    const info = getEvidenceJudgmentRuntimeInfo();
    expect(info.evidence_judgment_mode).toBe('live');
    expect(info.evidence_judgment_mode_source).toBe('AAIRP_EVIDENCE_JUDGMENT_MODE');
  });
});

describe('EvidenceJudgmentService judgment_mode stamp', () => {
  const evidence: EvidenceRecord = {
    evidence_id: 'ev1',
    title: 'capacity memo',
    evidence_source_type: 'INTERNAL_TEST',
    scope: { countries: ['SG'], categories: ['sa.rice_cooker'], skus: ['PC201'] },
    claim_risk_types: ['capacity-claim'],
    file: { filename: 'memo.txt', mime_type: 'text/plain', storage_path: 'files/memo.txt' },
    created_at: '2026-07-17T00:00:00.000Z',
  };

  const context: EvidenceJudgmentContext = {
    review_id: 'r1',
    finding_id: 'f1',
    country_id: 'SG',
    category_id: 'sa.rice_cooker',
    product_sku: 'PC201',
    ad_text: 'Cook for up to 8-10 people',
    finding_summary: 'capacity claim',
    remediation_type: 'EVIDENCE_SUPPLEMENT',
    risk_type: 'capacity-claim',
    claim_anchor_text: 'up to 8-10 people',
  };

  it('stamps stub mode and does not invent none for readable text', async () => {
    process.env.AAIRP_EVIDENCE_JUDGMENT_MODE = 'stub';
    const store = {
      readEvidenceFile: async () =>
        Buffer.from(
          'PLACEHOLDER-CAP-001 Total weight 1.96-2.45kg ÷ 245g = 8-10 people for PC201.',
          'utf8',
        ),
    } as Pick<IEvidenceStore, 'readEvidenceFile'>;

    const service = new EvidenceJudgmentService({
      evidenceStore: store as IEvidenceStore,
      llmGateway: {
        complete: async () => ({
          content: JSON.stringify({
            relevance: 'strong',
            relevance_reasoning: 'matches',
            sufficiency: 'sufficient',
            sufficiency_reasoning: 'method present',
            extracted_key_facts: '245g reference yields 8-10',
          }),
          model: 'stub',
        }),
      },
      readTextFile: () => 'template {evidence_text} {claim_anchor_text}',
    });

    const judgment = await service.judgeAttachedEvidence(evidence, context);
    expect(judgment.judgment_mode).toBe('stub');
    expect(judgment.relevance).toBe('strong');
    expect(judgment.sufficiency).toBe('sufficient');
  });

  it('stamps text_unreadable none without calling LLM', async () => {
    process.env.AAIRP_EVIDENCE_JUDGMENT_MODE = 'live';
    let llmCalls = 0;
    const store = {
      readEvidenceFile: async () => Buffer.from('%PDF-1.4 binary junk with no text layer', 'utf8'),
    } as Pick<IEvidenceStore, 'readEvidenceFile'>;

    const service = new EvidenceJudgmentService({
      evidenceStore: store as IEvidenceStore,
      llmGateway: {
        complete: async () => {
          llmCalls += 1;
          throw new Error('should not be called');
        },
      },
      readTextFile: () => 'template',
    });

    const judgment = await service.judgeAttachedEvidence(
      {
        ...evidence,
        file: {
          filename: 'scan.pdf',
          mime_type: 'application/pdf',
          storage_path: 'files/scan.pdf',
        },
      },
      context,
    );

    expect(llmCalls).toBe(0);
    expect(judgment.text_unreadable).toBe(true);
    expect(judgment.relevance).toBe('none');
    expect(judgment.sufficiency).toBe('insufficient');
    expect(judgment.judgment_mode).toBe('live');
    expect(judgment.extracted_key_facts).toBe('');
  });
});
