import { describe, expect, it } from 'vitest';
import type { EvidenceRecord } from '@aairp/shared-kernel';
import {
  applySourceTypeRules,
  EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT,
  renderEvidenceJudgmentPrompt,
  sliceEvidenceTextForPrompt,
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

  it('adversarial claim-echo fixture locks sufficiency=insufficient', () => {
    const c = fixture.cases.find((x) => x.case_id === 'adversarial-claim-echo-no-methodology')!;
    expect(c).toBeTruthy();
    expect(c.expect.sufficiency).toBe('insufficient');
    expect(c.llm_stub_response?.sufficiency).toBe('insufficient');
    expect(c.evidence.evidence_text.toLowerCase()).toContain('feed up to 8 people');
    expect(c.evidence.evidence_text.toLowerCase()).not.toMatch(/method|weighed|calculation|fda/i);
  });

  it('numeric containment fixtures: covered vs exceeded stay separate from hollow-echo', () => {
    const covered = fixture.cases.find(
      (x) => x.case_id === 'numeric-containment-claim-covered-by-higher-evidence',
    )!;
    const exceeded = fixture.cases.find(
      (x) => x.case_id === 'numeric-containment-claim-exceeds-evidence-upper-bound',
    )!;
    const hollow = fixture.cases.find((x) => x.case_id === 'adversarial-claim-echo-no-methodology')!;

    expect(covered.expect).toEqual({
      relevance: 'strong',
      sufficiency: 'sufficient',
      skip_llm: false,
    });
    expect(exceeded.expect.sufficiency).toBe('insufficient');
    expect(exceeded.expect.relevance === 'none' || exceeded.expect.sufficiency === 'insufficient').toBe(
      true,
    );
    // Covered/exceeded use real methodology text; hollow must not.
    expect(covered.evidence.evidence_text).toMatch(/245g|calibrated scale/i);
    expect(hollow.evidence.evidence_text).not.toMatch(/245g|calibrated scale/i);
  });

  it('locks hyperheat footnote three-methods / evidence-covers-one as strong+insufficient', () => {
    const c = fixture.cases.find(
      (x) => x.case_id === 'hyperheat-70pct-footnote-three-methods-evidence-covers-one',
    )!;
    expect(c.context.disclaimer_text).toMatch(/slow cooking,\s*simmering or braising/i);
    expect(c.evidence.evidence_text.toLowerCase()).toContain('slow cooker');
    expect(c.evidence.evidence_text.toLowerCase()).toMatch(/no simmering or braising/);
    expect(c.expect).toEqual({
      relevance: 'strong',
      sufficiency: 'insufficient',
      skip_llm: false,
    });
    expect(c.llm_stub_response?.relevance).toBe('strong');
    expect(c.llm_stub_response?.sufficiency).toBe('insufficient');
    expect(c.llm_stub_response?.sufficiency_reasoning.toLowerCase()).toMatch(
      /simmering|braising/,
    );
  });
});

describe('evidence judgment prompt text window', () => {
  it('reports full_len vs prompt_len and truncates over the limit', () => {
    const short = sliceEvidenceTextForPrompt('abc');
    expect(short).toEqual({
      text_for_prompt: 'abc',
      full_len: 3,
      prompt_len: 3,
      truncated: false,
      limit: EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT,
    });

    const long = 'x'.repeat(EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT + 500);
    const window = sliceEvidenceTextForPrompt(long);
    expect(window.full_len).toBe(EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT + 500);
    expect(window.prompt_len).toBe(EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT);
    expect(window.truncated).toBe(true);
    expect(window.text_for_prompt).toHaveLength(EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT);
    expect(window.text_for_prompt).toBe('x'.repeat(EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT));
  });

  it('renderEvidenceJudgmentPrompt only injects the windowed prefix', () => {
    const marker = 'MARKER_AFTER_WINDOW';
    const evidenceText = `${'a'.repeat(EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT)}${marker}`;
    const prompt = renderEvidenceJudgmentPrompt('{evidence_text}', {
      review_id: 'r1',
      finding_id: 'f1',
      country_id: 'SG',
      category_id: 'sa.rice_cooker',
      ad_text: 'Family meals in 30 minutes',
      finding_summary: 'timing claim',
      risk_type: 'unsubstantiated-quantitative-claim',
      claim_anchor_text: '30 minutes',
      evidence: stubEvidence({
        evidence_source_type: 'INTERNAL_TEST',
        scope: {},
        title: 'QSG',
      }),
      evidence_text: evidenceText,
    });
    expect(prompt).toHaveLength(EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT);
    expect(prompt.includes(marker)).toBe(false);
  });

  it('renderEvidenceJudgmentPrompt injects explicit disclaimer_text slot', () => {
    const prompt = renderEvidenceJudgmentPrompt(
      'anchor={claim_anchor_text}; disclaimer={disclaimer_text}; ad={ad_text}',
      {
        review_id: 'r1',
        finding_id: 'f1',
        country_id: 'SG',
        category_id: 'sa.rice_cooker',
        ad_text: '1200W Power to Cook Up to 70% faster*',
        disclaimer_text: '*Compared with slow cooking, simmering or braising',
        finding_summary: 'timing claim',
        risk_type: 'unsubstantiated-quantitative-claim',
        claim_anchor_text: '70% faster',
        evidence: stubEvidence({
          evidence_source_type: 'INTERNAL_TEST',
          scope: {},
          title: 'memo',
        }),
        evidence_text: 'tested vs slow cooking only',
      },
    );
    expect(prompt).toContain(
      'disclaimer=*Compared with slow cooking, simmering or braising',
    );
    expect(prompt).toContain('ad=1200W Power to Cook Up to 70% faster*');
  });
});
