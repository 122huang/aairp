import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EvidenceSourceType, RemediationType } from '@aairp/shared-kernel';

export type EvidenceJudgmentFixtureCase = {
  case_id: string;
  source?: string;
  notes?: string;
  context: {
    country_id: string;
    category_id: string;
    product_sku?: string;
    ad_text: string;
    disclaimer_text?: string;
    claim_anchor_text: string;
    finding_summary: string;
    remediation_type: RemediationType;
    risk_type: string;
  };
  evidence: {
    title: string;
    evidence_source_type: EvidenceSourceType;
    scope?: { countries?: string[]; categories?: string[]; skus?: string[] };
    valid_until?: string;
    evidence_text: string;
  };
  expect: {
    relevance: 'strong' | 'partial' | 'none';
    sufficiency: 'sufficient' | 'insufficient';
    skip_llm?: boolean;
    source_rule_applied?: boolean;
    text_unreadable?: boolean;
    expired?: boolean;
  };
  /** Stub LLM output for eval (mechanism verification, not live model). */
  llm_stub_response?: {
    relevance: 'strong' | 'partial' | 'none';
    relevance_reasoning: string;
    sufficiency: 'sufficient' | 'insufficient';
    sufficiency_reasoning: string;
    extracted_key_facts: string;
  };
};

export type EvidenceJudgmentFixture = {
  schema_version: string;
  fixture_id: string;
  description: string;
  cases: EvidenceJudgmentFixtureCase[];
};

const defaultPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../benchmark/evidence-judgment-fixture.json',
);

export function loadEvidenceJudgmentFixture(path = defaultPath): EvidenceJudgmentFixture {
  return JSON.parse(readFileSync(path, 'utf8')) as EvidenceJudgmentFixture;
}
