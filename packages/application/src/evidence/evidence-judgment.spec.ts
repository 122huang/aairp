import { describe, expect, it } from 'vitest';
import type { EvidenceRecord } from '@aairp/shared-kernel';
import {
  applySourceTypeRules,
  structuralScopeExcludes,
} from './evidence-judgment-rules.js';
import { loadEvidenceJudgmentFixture } from '../evaluation/load-evidence-judgment-fixture.js';

function stubEvidence(
  partial: Partial<EvidenceRecord> & Pick<EvidenceRecord, 'evidence_source_type' | 'scope'>,
): EvidenceRecord {
  return {
    evidence_id: 'ev_test',
    title: 'test',
    claim_risk_types: [],
    file: { filename: 't.txt', mime_type: 'text/plain', storage_path: 'files/t.txt' },
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe('evidence judgment rules', () => {
  const fixture = loadEvidenceJudgmentFixture();

  it('CLM-012884 scope overlaps — not structurally excluded', () => {
    const c = fixture.cases.find((x) => x.case_id === 'CLM-012884-internal-capacity')!;
    const evidence = stubEvidence({
      evidence_source_type: c.evidence.evidence_source_type,
      scope: c.evidence.scope ?? {},
    });
    expect(
      structuralScopeExcludes(evidence, {
        country_id: c.context.country_id,
        category_id: c.context.category_id,
        product_sku: c.context.product_sku,
      }),
    ).toBe(false);
  });

  it('SGS 40N1S — structural prescreen excludes (SKU mismatch)', () => {
    const c = fixture.cases.find((x) => x.case_id === 'SGS-40N1S-wrong-model')!;
    const evidence = stubEvidence({
      evidence_source_type: c.evidence.evidence_source_type,
      scope: c.evidence.scope ?? {},
    });
    expect(
      structuralScopeExcludes(evidence, {
        country_id: c.context.country_id,
        category_id: c.context.category_id,
        product_sku: c.context.product_sku,
      }),
    ).toBe(true);
  });

  it('INTERNAL_TEST caps health-implication to insufficient', () => {
    const result = applySourceTypeRules(
      {
        relevance: 'strong',
        relevance_reasoning: 'x',
        sufficiency: 'sufficient',
        sufficiency_reasoning: 'x',
        extracted_key_facts: 'demo',
        judged_at: new Date().toISOString(),
      },
      'EVIDENCE_SUPPLEMENT',
      'INTERNAL_TEST',
      'health-implication',
    );
    expect(result.sufficiency).toBe('insufficient');
    expect(result.source_rule_applied).toBe(true);
  });

  it('EXTERNAL_STATUS rejects INTERNAL_TEST', () => {
    const result = applySourceTypeRules(
      {
        relevance: 'strong',
        relevance_reasoning: 'x',
        sufficiency: 'sufficient',
        sufficiency_reasoning: 'x',
        extracted_key_facts: 'x',
        judged_at: new Date().toISOString(),
      },
      'EXTERNAL_STATUS_VERIFICATION',
      'INTERNAL_TEST',
      'certification-evidence',
    );
    expect(result.sufficiency).toBe('insufficient');
  });

  it('fixture prescreen expectations', () => {
    for (const c of fixture.cases) {
      if (!c.expect.skip_llm) continue;
      if (c.expect.text_unreadable) continue;
      if (c.expect.expired) continue;
      const evidence = stubEvidence({
        evidence_source_type: c.evidence.evidence_source_type,
        scope: c.evidence.scope ?? {},
      });
      const excluded = structuralScopeExcludes(evidence, {
        country_id: c.context.country_id,
        category_id: c.context.category_id,
        product_sku: c.context.product_sku,
      });
      expect(excluded, c.case_id).toBe(true);
    }
  });
});
