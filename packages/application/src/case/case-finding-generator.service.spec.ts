import { describe, expect, it } from 'vitest';
import type { CaseRetrievalResult } from '@aairp/shared-kernel';
import { CaseFindingGeneratorService } from './case-finding-generator.service.js';

const retrieval: CaseRetrievalResult = {
  review_id: 'rev_new',
  precedents: [
    {
      case_id: 'case_a',
      case_version: 1,
      lifecycle_status: 'CONFIRMED',
      final_decision: 'REJECT',
      similarity_score: 0.91,
      match_reason: 'dimension match',
      summary: 'Prior REJECT',
    },
    {
      case_id: 'case_b',
      case_version: 1,
      lifecycle_status: 'CONFIRMED',
      final_decision: 'REJECT',
      similarity_score: 0.88,
      match_reason: 'dimension match',
      summary: 'Prior REJECT',
    },
    {
      case_id: 'case_pass',
      case_version: 1,
      lifecycle_status: 'CONFIRMED',
      final_decision: 'PASS',
      similarity_score: 0.95,
      match_reason: 'exact content hash match',
      summary: 'Prior PASS',
    },
    {
      case_id: 'case_generated',
      case_version: 1,
      lifecycle_status: 'GENERATED',
      final_decision: 'WARN',
      similarity_score: 0.99,
      match_reason: 'dimension match',
      summary: 'Generated only',
    },
  ],
  exact_content_hash_match: false,
  coverage_score: 0.91,
  retrieval_strategy: 'facet+hash_v1',
  retrieved_at: '2026-06-26T12:00:00.000Z',
};

describe('CaseFindingGeneratorService', () => {
  it('groups CONFIRMED non-PASS precedents into case findings', () => {
    const service = new CaseFindingGeneratorService({
      createFindingId: () => '11111111-1111-1111-1111-111111111111',
    });

    const findings = service.generate(retrieval, {
      reviewId: 'rev_new',
      rulePackVersion: 'demo-rule-1.0.0',
      findings: [],
      hasBlocker: false,
      evaluatedAt: '2026-06-26T12:00:00.000Z',
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      module: 'CASE',
      refType: 'CASE_PRECEDENT',
      decision: 'WARN',
      summary: '2 similar CONFIRMED cases were REJECT',
      evaluationDetail: {
        precedentCaseIds: ['case_a', 'case_b'],
        lifecycleStatus: 'CONFIRMED',
      },
    });
  });
});
