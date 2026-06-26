import { describe, expect, it } from 'vitest';
import type { CaseRecord, CaseRetrievalResult, ICaseStore, RuleEvaluationResult } from '@aairp/shared-kernel';
import { CaseContextAssembler } from './case-context-assembler.service.js';

const retrieval: CaseRetrievalResult = {
  review_id: 'rev_new',
  precedents: [
    {
      case_id: 'case_example_sg_health_reject',
      case_version: 1,
      lifecycle_status: 'CONFIRMED',
      final_decision: 'REJECT',
      similarity_score: 0.91,
      match_reason: 'country, category, and platform match',
      summary: 'Prior review reached REJECT',
    },
  ],
  exact_content_hash_match: false,
  coverage_score: 0.91,
  retrieval_strategy: 'facet+hash_v1',
  retrieved_at: '2026-06-26T12:00:00.000Z',
};

const ruleResult: RuleEvaluationResult = {
  reviewId: 'rev_new',
  rulePackVersion: 'demo-rule-1.0.0',
  findings: [
    {
      module: 'RULE',
      findingId: 'rf_1',
      severity: 'BLOCKER',
      decision: 'FAIL',
      refType: 'RULE',
      refId: 'demo-sg-health-forbidden-claim',
      refVersionId: 'demo-sg-health-forbidden-claim-v1',
      summary: 'Forbidden claim',
      confidence: 1,
    },
  ],
  hasBlocker: true,
  evaluatedAt: '2026-06-26T12:00:00.000Z',
};

const sampleCase: CaseRecord = {
  schema_version: '1.0.0',
  case_version: 1,
  case_id: 'case_example_sg_health_reject',
  review_id: 'rev_old',
  advertisement_id: 'ad_old',
  lifecycle_status: 'CONFIRMED',
  dimensions: {
    tenant_id: 'demo',
    country_id: 'SG',
    platform_id: 'META',
    category_id: 'health.supplement',
  },
  advertisement: {
    advertisement_id: 'ad_old',
    content_hash: 'hash_old',
    content_version: 1,
    ad_type: 'SOCIAL_POST',
    content: { text: 'cure diabetes', image_urls: [] },
    tags: [],
  },
  context_builder_output: {
    review_id: 'rev_old',
    content_hash: 'hash_old',
    content_version: 1,
    normalized_content: { text: 'cure diabetes', imageUrls: [] },
    resolved_knowledge_versions: {
      rulePackVersion: 'demo-rule-1.0.0',
      policyPackVersion: 'demo-policy-1.0.0',
      playbookPackVersion: 'demo-playbook-1.0.0',
    },
    advertisement_context: {},
    tags: [],
    built_at: '2026-06-26T10:00:00.000Z',
  },
  matched_rules: [
    {
      finding_id: 'rf_old',
      ref_id: 'demo-sg-health-forbidden-claim',
      ref_version_id: 'demo-sg-health-forbidden-claim-v1',
      severity: 'BLOCKER',
      decision: 'FAIL',
      summary: 'Forbidden claim',
      confidence: 1,
    },
  ],
  matched_playbooks: [],
  llm_analysis: {
    prompt_pack_version: 'demo-open-risk-1.1.0',
    skipped: true,
    skip_reason: 'HAS_BLOCKER',
    findings: [],
    evaluated_at: '2026-06-26T10:08:00.000Z',
  },
  decision: {
    ai_decision: 'REJECT',
    confidence: 0.95,
    rationale: 'Rule BLOCKER',
    finding_counts: { rule: 1, playbook: 0, llm: 0 },
    decided_at: '2026-06-26T10:09:00.000Z',
    final_decision: 'REJECT',
  },
  evidence: [],
  recommendation: {
    summary: 'Remove cure claim',
    actions: [],
    derived_from: [],
  },
  human_feedback: null,
  reference_regulations: [
    {
      law_name: 'SG Health Products Act (Demo)',
      article: 'Section 7 — Prohibited claims',
      jurisdiction: 'SG',
      source_module: 'RULE',
      source_ref_id: 'demo-sg-health-forbidden-claim',
    },
  ],
  metadata: {
    source: 'test',
    pipeline_version: 'test',
    open_risk_skipped: true,
    storage_phase: 'json',
    review_id: 'rev_old',
    embedding_id: null,
    similar_case_ids: [],
  },
  created_at: '2026-06-26T10:11:00.000Z',
  updated_at: '2026-06-26T10:11:00.000Z',
};

function createStore(records: Record<string, CaseRecord>): ICaseStore {
  return {
    save: async () => ({ case_id: 'case_x', path: 'x', created: true }),
    findByCaseId: async (caseId) => records[caseId] ?? null,
    findByReviewId: async () => null,
    search: async () => [],
    listManifest: async () => [],
    exportAll: async () => Object.values(records),
  };
}

describe('CaseContextAssembler', () => {
  it('assembles precedent summaries, shared rule refs, and regulation citations', async () => {
    const assembler = new CaseContextAssembler(
      createStore({ case_example_sg_health_reject: sampleCase }),
    );

    const context = await assembler.assemble(retrieval, ruleResult);

    expect(context.caseIds).toEqual(['case_example_sg_health_reject']);
    expect(context.sharedRuleRefs).toEqual(['demo-sg-health-forbidden-claim']);
    expect(context.regulationCitations).toHaveLength(1);
    expect(context.precedentSummaries[0]).toContain('case_id=case_example_sg_health_reject');
    expect(context.precedentSummaries[0]).toContain('Remove cure claim');
    expect(context.coldStart).toBe(false);
  });
});
