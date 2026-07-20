import type {
  EvidenceAiJudgment,
  EvidenceJudgmentContext,
  EvidenceRecord,
  EvidenceSourceType,
} from '@aairp/shared-kernel';
import type { RemediationType } from '@aairp/shared-kernel';

/** Risk types where INTERNAL_TEST cannot reach sufficient (health/comparative/ranking/social proof). */
export const HIGH_SENSITIVITY_RISK_TYPES = new Set([
  'health-implication',
  'health-superlative-claim',
  'health-claim-blocker',
  'unsupported-comparative-claim',
  'market-ranking-claim',
  'unsubstantiated-social-proof',
  'social-proof-claim',
  'certification-evidence',
  'false-authority-endorsement',
  'jp-ranking-unsubstantiated',
  'kr-comparative-denigration',
]);

export type ProductContext = {
  country_id: string;
  category_id: string;
  product_sku?: string;
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s\-_/]+/g, '');
}

function skuMatches(evidenceSku: string, caseSku: string | undefined): boolean {
  if (!caseSku?.trim()) return true;
  const a = normalizeToken(evidenceSku);
  const b = normalizeToken(caseSku);
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Layer 1 — deterministic structural prescreen.
 * Each specified scope dimension must overlap; any mismatch → relevance none, skip LLM.
 */
export function structuralScopeExcludes(
  evidence: EvidenceRecord,
  context: ProductContext,
): boolean {
  const countries = evidence.scope.countries?.filter(Boolean);
  if (countries?.length) {
    const ok = countries.some((c) => c.toUpperCase() === context.country_id.toUpperCase());
    if (!ok) return true;
  }

  const categories = evidence.scope.categories?.filter(Boolean);
  if (categories?.length) {
    if (!categories.includes(context.category_id)) return true;
  }

  const skus = evidence.scope.skus?.filter(Boolean);
  if (skus?.length) {
    const ok = skus.some((sku) => skuMatches(sku, context.product_sku));
    if (!ok) return true;
  }

  return false;
}

export function buildPrescreenJudgment(reason: string): EvidenceAiJudgment {
  return {
    relevance: 'none',
    relevance_reasoning: reason,
    sufficiency: 'insufficient',
    sufficiency_reasoning: 'Structured scope (country/category/SKU) does not overlap with this case — semantic judgment skipped.',
    extracted_key_facts: '',
    prescreen_excluded: true,
    judged_at: new Date().toISOString(),
  };
}

export function buildUnreadableJudgment(): EvidenceAiJudgment {
  return {
    relevance: 'none',
    relevance_reasoning:
      'Evidence file text could not be extracted as readable content (PDF text-layer parse failed or file is image-only; v1 has no OCR).',
    sufficiency: 'insufficient',
    sufficiency_reasoning:
      'Please re-upload a text-layer PDF or plain-text export — same guidance as demo-apac-sa-evidence-unreadable.',
    extracted_key_facts: '',
    text_unreadable: true,
    judged_at: new Date().toISOString(),
  };
}

export function buildExpiredJudgment(validUntil: string): EvidenceAiJudgment {
  return {
    relevance: 'partial',
    relevance_reasoning: `Evidence valid_until (${validUntil}) is before the review date.`,
    sufficiency: 'insufficient',
    sufficiency_reasoning: 'Expired evidence cannot substantiate current advertising claims.',
    extracted_key_facts: '',
    judged_at: new Date().toISOString(),
  };
}

export function isEvidenceExpired(validUntil: string | undefined, asOf = new Date()): boolean {
  if (!validUntil?.trim()) return false;
  const end = new Date(validUntil);
  if (Number.isNaN(end.getTime())) return false;
  return end < asOf;
}

/** Hard caps applied before or after LLM based on remediation_type + evidence_source_type. */
export function applySourceTypeRules(
  judgment: EvidenceAiJudgment,
  remediationType: RemediationType | undefined,
  sourceType: EvidenceSourceType,
  riskType: string,
): EvidenceAiJudgment {
  if (remediationType === 'EXTERNAL_STATUS_VERIFICATION') {
    if (sourceType === 'INTERNAL_TEST') {
      return {
        ...judgment,
        sufficiency: 'insufficient',
        sufficiency_reasoning:
          'EXTERNAL_STATUS_VERIFICATION requires OFFICIAL_CERTIFICATION or THIRD_PARTY_LAB with a verifiable registration number; INTERNAL_TEST is not accepted.',
        source_rule_applied: true,
      };
    }
    const allowed =
      sourceType === 'OFFICIAL_CERTIFICATION' ||
      (sourceType === 'THIRD_PARTY_LAB' && hasRegistrationNumber(judgment.extracted_key_facts));
    if (!allowed) {
      return {
        ...judgment,
        sufficiency: 'insufficient',
        sufficiency_reasoning:
          'EXTERNAL_STATUS_VERIFICATION requires OFFICIAL_CERTIFICATION or THIRD_PARTY_LAB with a verifiable registration number; INTERNAL_TEST is not accepted.',
        source_rule_applied: true,
      };
    }
  }

  if (
    remediationType === 'EVIDENCE_SUPPLEMENT' &&
    sourceType === 'INTERNAL_TEST' &&
    HIGH_SENSITIVITY_RISK_TYPES.has(riskType)
  ) {
    return {
      ...judgment,
      sufficiency: 'insufficient',
      sufficiency_reasoning:
        `INTERNAL_TEST cannot substantiate high-sensitivity risk type "${riskType}" (health/comparative/ranking/social proof). Third-party or official evidence required.`,
      source_rule_applied: true,
    };
  }

  if (
    remediationType === 'EVIDENCE_SUPPLEMENT' &&
    sourceType === 'INTERNAL_TEST' &&
    judgment.sufficiency === 'sufficient' &&
    !hasMethodologySignals(judgment)
  ) {
    return {
      ...judgment,
      sufficiency: 'insufficient',
      sufficiency_reasoning:
        'INTERNAL_TEST for objective performance/capacity claims requires visible methodology, raw data, or cited standard — conclusion-only memos are insufficient.',
      source_rule_applied: true,
    };
  }

  return judgment;
}

function hasRegistrationNumber(text: string): boolean {
  return /\b(reg(?:istration)?\.?\s*(?:no|number|#)?\s*[:.]?\s*[A-Z0-9\-]{4,}|证书编号|登记号|备案号|cert(?:ificate)?\.?\s*#?\s*[A-Z0-9\-]{4,})/i.test(
    text,
  );
}

function hasMethodologySignals(judgment: EvidenceAiJudgment): boolean {
  const blob = `${judgment.extracted_key_facts} ${judgment.sufficiency_reasoning}`.toLowerCase();
  return (
    /\b(method|methodology|test condition|sample size|实测|测试方法|标准|iso|astm|gb\/t|fda|245\s*g|reference weight|÷|\/)/i.test(
      blob,
    ) || judgment.extracted_key_facts.trim().length >= 40
  );
}

export type JudgmentPromptContext = EvidenceJudgmentContext & {
  evidence: EvidenceRecord;
  evidence_text: string;
};

/**
 * Hard window for `{evidence_text}` in the judgment prompt.
 * Step-1 mitigation: stamp + UI when truncated. Step-2 will replace prefix
 * truncation with claim-relevant retrieval / chunk-then-merge.
 */
export const EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT = 12_000;

export type EvidenceTextPromptWindow = {
  text_for_prompt: string;
  full_len: number;
  prompt_len: number;
  truncated: boolean;
  limit: number;
};

export function sliceEvidenceTextForPrompt(
  evidenceText: string,
  limit = EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT,
): EvidenceTextPromptWindow {
  const full_len = evidenceText.length;
  const text_for_prompt = evidenceText.slice(0, limit);
  const prompt_len = text_for_prompt.length;
  return {
    text_for_prompt,
    full_len,
    prompt_len,
    truncated: full_len > prompt_len,
    limit,
  };
}

export function renderEvidenceJudgmentPrompt(
  template: string,
  ctx: JudgmentPromptContext,
): string {
  const window = sliceEvidenceTextForPrompt(ctx.evidence_text);
  return template
    .replaceAll('{prompt_pack_version}', 'evidence-judgment-v1')
    .replaceAll('{claim_anchor_text}', ctx.claim_anchor_text)
    .replaceAll('{ad_text}', ctx.ad_text)
    .replaceAll('{finding_summary}', ctx.finding_summary)
    .replaceAll('{risk_type}', ctx.risk_type)
    .replaceAll('{remediation_type}', ctx.remediation_type ?? 'EVIDENCE_SUPPLEMENT')
    .replaceAll('{evidence_source_type}', ctx.evidence.evidence_source_type)
    .replaceAll('{evidence_title}', ctx.evidence.title)
    .replaceAll('{evidence_text}', window.text_for_prompt)
    .replaceAll('{country_id}', ctx.country_id)
    .replaceAll('{category_id}', ctx.category_id)
    .replaceAll('{product_sku}', ctx.product_sku ?? '(not provided)')
    .replaceAll('{issued_date}', ctx.evidence.issued_date ?? '(unknown)')
    .replaceAll('{valid_until}', ctx.evidence.valid_until ?? '(unknown)');
}
