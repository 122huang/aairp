import { describe, expect, it } from 'vitest';
import type { CaseRecordDto } from '@/api/cases';
import { caseRecordToDemoReviewResponse } from './case-to-review-result';

function sampleCase(): CaseRecordDto {
  return {
    case_id: 'case_map_1',
    case_version: 1,
    review_id: 'rev_map_1',
    advertisement_id: 'ad_map_1',
    thread_id: 'thread_map_1',
    parent_case_id: 'case_root',
    lifecycle_status: 'GENERATED',
    dimensions: {
      tenant_id: 'demo',
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'sa.air_fryer',
      legal_reviewed_market: true,
    },
    advertisement: {
      advertisement_id: 'ad_map_1',
      content_hash: 'h',
      content_version: 1,
      ad_type: 'BRAND_PRODUCT',
      content: { text: 'Hello air fryer', image_urls: [] },
      tags: [],
    },
    matched_rules: [
      {
        finding_id: 'f1',
        ref_id: 'demo-sg-sponsored-disclosure',
        ref_version_id: 'v1',
        severity: 'LOW',
        decision: 'INFO',
        summary: 'disclosure',
        confidence: 1,
        remediation_type: 'NOT_APPLICABLE_DISCLOSURE',
        evaluation_detail: {
          matchedSpans: [{ field: 'text', start: 0, end: 5, text: 'Hello' }],
        },
      },
    ],
    matched_playbooks: [],
    llm_analysis: {
      prompt_pack_version: 'p1',
      skipped: false,
      findings: [],
      evaluated_at: '2026-07-18T00:00:00.000Z',
    },
    decision: {
      ai_decision: 'PASS',
      confidence: 0.8,
      rationale: 'ok',
      finding_counts: { rule: 1, playbook: 0, llm: 0 },
      decided_at: '2026-07-18T00:00:00.000Z',
      final_decision: 'PASS',
    },
    created_at: '2026-07-18T00:00:00.000Z',
    updated_at: '2026-07-18T00:00:00.000Z',
  };
}

describe('caseRecordToDemoReviewResponse', () => {
  it('maps case findings and thread fields for the read-only result page', () => {
    const result = caseRecordToDemoReviewResponse(sampleCase());
    expect(result.case_id).toBe('case_map_1');
    expect(result.thread_id).toBe('thread_map_1');
    expect(result.parent_case_id).toBe('case_root');
    expect(result.final_decision).toBe('PASS');
    expect(result.summary.findings).toHaveLength(1);
    expect(result.summary.findings[0]).toMatchObject({
      module: 'RULE',
      ref_id: 'demo-sg-sponsored-disclosure',
      remediation_type: 'NOT_APPLICABLE_DISCLOSURE',
      evidence_spans: [{ text: 'Hello' }],
    });
  });
});
