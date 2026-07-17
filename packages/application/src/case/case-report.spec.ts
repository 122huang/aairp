import { describe, expect, it } from 'vitest';
import type { CaseRecord, FindingEvidenceLink } from '@aairp/shared-kernel';
import { supportsEvidenceAttachment } from '@aairp/shared-kernel';
import {
  collectCaseFindings,
  evaluateBusinessHandoffEligibility,
  filterBusinessHandoffFindings,
} from './case-report-eligibility.js';
import { renderBusinessHandoffHtml, renderLegalAuditHtml } from './case-report-html.js';
import type { CaseReportModel } from './case-report.model.js';

function baseCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    schema_version: '1.0.0',
    case_version: 1,
    case_id: 'case_a',
    review_id: 'review_a',
    advertisement_id: 'ad_a',
    thread_id: 'case_a',
    reviewer_id: 'pilot-default',
    lifecycle_status: 'GENERATED',
    dimensions: {
      tenant_id: 'demo',
      country_id: 'SG',
      platform_id: 'tiktok',
      category_id: 'sa.vacuum_floor',
      legal_reviewed_market: true,
    },
    advertisement: {
      advertisement_id: 'ad_a',
      content_hash: 'hash',
      content_version: 1,
      ad_type: 'INFLUENCER_UGC',
      content: { text: 'sample ad copy for report', image_urls: [] },
      tags: [],
    },
    context_builder_output: {
      review_id: 'review_a',
      content_hash: 'hash',
      content_version: 1,
      normalized_content: { text: 'sample ad copy for report', imageUrls: [] },
      resolved_knowledge_versions: {
        rulePackVersion: 'demo',
        policyPackVersion: 'demo',
        playbookPackVersion: 'demo',
      },
      advertisement_context: {},
      tags: [],
      built_at: '2026-07-17T00:00:00.000Z',
    },
    matched_rules: [],
    matched_playbooks: [],
    llm_analysis: {
      prompt_pack_version: 'demo',
      skipped: true,
      findings: [],
      evaluated_at: '2026-07-17T00:00:00.000Z',
    },
    decision: {
      ai_decision: 'PASS',
      confidence: 0.9,
      rationale: 'no blockers',
      finding_counts: { rule: 0, playbook: 0, llm: 0 },
      decided_at: '2026-07-17T00:00:00.000Z',
      final_decision: 'PASS',
    },
    evidence: [],
    recommendation: { summary: '', actions: [], derived_from: [] },
    human_feedback: null,
    reference_regulations: [],
    metadata: {
      source: 'test',
      pipeline_version: 'test',
      open_risk_skipped: true,
      storage_phase: 'json',
      review_id: 'review_a',
      embedding_id: null,
      similar_case_ids: [],
    },
    created_at: '2026-07-17T00:00:00.000Z',
    updated_at: '2026-07-17T00:00:00.000Z',
    ...overrides,
  };
}

function link(
  partial: Partial<FindingEvidenceLink> & Pick<FindingEvidenceLink, 'finding_id' | 'status'>,
): FindingEvidenceLink {
  return {
    link_id: partial.link_id ?? 'link_1',
    case_id: partial.case_id ?? 'case_a',
    review_id: partial.review_id ?? 'review_a',
    finding_id: partial.finding_id,
    evidence_id: partial.evidence_id ?? 'ev_1',
    status: partial.status,
    created_at: partial.created_at ?? '2026-07-17T00:00:00.000Z',
    ai_judgment: partial.ai_judgment,
    override_reason: partial.override_reason,
    confirmed_at: partial.confirmed_at,
  };
}

describe('case report eligibility + filters', () => {
  it('treats undefined remediation_type as not evidence-attachable', () => {
    expect(supportsEvidenceAttachment(undefined)).toBe(false);
    expect(supportsEvidenceAttachment(undefined, 'REVIEW')).toBe(false);
  });

  it('filters only EXTERNAL_STATUS_VERIFICATION and NOT_APPLICABLE_DISCLOSURE', () => {
    const caseRecord = baseCase({
      matched_rules: [
        {
          finding_id: 'f1',
          ref_id: 'rule-status',
          ref_version_id: 'v1',
          severity: 'HIGH',
          decision: 'WARN',
          summary: 'verify registration',
          confidence: 0.8,
          remediation_type: 'EXTERNAL_STATUS_VERIFICATION',
        },
        {
          finding_id: 'f2',
          ref_id: 'rule-disclosure',
          ref_version_id: 'v1',
          severity: 'LOW',
          decision: 'INFO',
          summary: 'add #ad',
          confidence: 0.7,
          remediation_type: 'NOT_APPLICABLE_DISCLOSURE',
        },
        {
          finding_id: 'f3',
          ref_id: 'rule-rewrite',
          ref_version_id: 'v1',
          severity: 'MEDIUM',
          decision: 'WARN',
          summary: 'rewrite claim',
          confidence: 0.7,
          remediation_type: 'REWRITE_ONLY',
        },
      ],
    });

    const handoff = filterBusinessHandoffFindings(collectCaseFindings(caseRecord));
    expect(handoff.map((f) => f.finding_id)).toEqual(['f1', 'f2']);
  });

  it('allows PASS and WARN regardless of evidence', () => {
    expect(evaluateBusinessHandoffEligibility(baseCase(), []).eligible).toBe(true);
    expect(
      evaluateBusinessHandoffEligibility(
        baseCase({
          decision: {
            ...baseCase().decision,
            final_decision: 'WARN',
            ai_decision: 'WARN',
          },
        }),
        [],
      ).eligible,
    ).toBe(true);
  });

  it('denies REJECT', () => {
    const result = evaluateBusinessHandoffEligibility(
      baseCase({
        decision: {
          ...baseCase().decision,
          final_decision: 'REJECT',
          ai_decision: 'REJECT',
        },
      }),
      [],
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.code).toBe('REJECT_UNRESOLVED');
  });

  it('denies REVIEW with manual-context finding', () => {
    const result = evaluateBusinessHandoffEligibility(
      baseCase({
        decision: {
          ...baseCase().decision,
          final_decision: 'REVIEW',
          ai_decision: 'REVIEW',
        },
        matched_rules: [
          {
            finding_id: 'f-manual',
            ref_id: 'demo-au-children',
            ref_version_id: 'v1',
            severity: 'HIGH',
            decision: 'REVIEW',
            summary: 'children context',
            confidence: 0.6,
            remediation_type: 'MANUAL_CONTEXT_JUDGMENT',
          },
        ],
      }),
      [],
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.code).toBe('REVIEW_MANUAL_CONTEXT');
  });

  it('denies REVIEW when remediation_type is undefined (untagged rule)', () => {
    const result = evaluateBusinessHandoffEligibility(
      baseCase({
        decision: {
          ...baseCase().decision,
          final_decision: 'REVIEW',
          ai_decision: 'REVIEW',
        },
        matched_rules: [
          {
            finding_id: 'f-untagged',
            ref_id: 'demo-untagged-review-rule',
            ref_version_id: 'v1',
            severity: 'HIGH',
            decision: 'REVIEW',
            summary: 'legacy rule without remediation tag',
            confidence: 0.6,
            // remediation_type intentionally omitted
          },
        ],
      }),
      [],
    );
    expect(result.eligible).toBe(false);
    if (!result.eligible) {
      expect(result.code).toBe('REVIEW_MANUAL_CONTEXT');
      expect(result.reasons.some((reason) => reason.includes('remediation=unset'))).toBe(true);
    }
  });

  it('allows REVIEW only when every REVIEW finding is evidence-confirmed', () => {
    const caseRecord = baseCase({
      decision: {
        ...baseCase().decision,
        final_decision: 'REVIEW',
        ai_decision: 'REVIEW',
      },
      matched_rules: [
        {
          finding_id: 'f-ev',
          ref_id: 'demo-capacity',
          ref_version_id: 'v1',
          severity: 'HIGH',
          decision: 'REVIEW',
          summary: 'needs evidence',
          confidence: 0.7,
          remediation_type: 'EVIDENCE_SUPPLEMENT',
        },
      ],
    });

    expect(evaluateBusinessHandoffEligibility(caseRecord, []).eligible).toBe(false);
    expect(
      evaluateBusinessHandoffEligibility(caseRecord, [
        link({ finding_id: 'f-ev', status: 'AI_JUDGED_PENDING_CONFIRMATION' }),
      ]).eligible,
    ).toBe(false);
    expect(
      evaluateBusinessHandoffEligibility(caseRecord, [
        link({ finding_id: 'f-ev', status: 'HUMAN_CONFIRMED' }),
      ]).eligible,
    ).toBe(true);
    expect(
      evaluateBusinessHandoffEligibility(caseRecord, [
        link({ finding_id: 'f-ev', status: 'HUMAN_OVERRODE', override_reason: 'ok' }),
      ]).eligible,
    ).toBe(true);
  });

  it('does not treat case lifecycle CONFIRMED as a substitute gate', () => {
    const result = evaluateBusinessHandoffEligibility(
      baseCase({
        lifecycle_status: 'CONFIRMED',
        decision: {
          ...baseCase().decision,
          final_decision: 'REVIEW',
          ai_decision: 'REVIEW',
        },
        matched_rules: [
          {
            finding_id: 'f-manual',
            ref_id: 'demo-cn-sensitive',
            ref_version_id: 'v1',
            severity: 'HIGH',
            decision: 'REVIEW',
            summary: 'sensitive',
            confidence: 0.5,
            remediation_type: 'MANUAL_CONTEXT_JUDGMENT',
          },
        ],
      }),
      [],
    );
    expect(result.eligible).toBe(false);
  });
});

describe('case report HTML templates', () => {
  function model(partial: Partial<CaseReportModel> = {}): CaseReportModel {
    const caseRecord = baseCase({
      matched_rules: [
        {
          finding_id: 'f1',
          ref_id: 'demo-sg-sponsored-disclosure',
          ref_version_id: 'v3',
          severity: 'LOW',
          decision: 'INFO',
          summary: 'confirm #ad',
          confidence: 0.8,
          remediation_type: 'NOT_APPLICABLE_DISCLOSURE',
        },
      ],
    });
    const findings = collectCaseFindings(caseRecord);
    return {
      template: 'business_handoff',
      generated_at: '2026-07-17T01:00:00.000Z',
      case: caseRecord,
      thread_cases: [caseRecord],
      findings,
      handoff_findings: filterBusinessHandoffFindings(findings),
      evidence_links: [],
      business_handoff: { eligible: true },
      ...partial,
    };
  }

  it('renders empty handoff message when no business findings', () => {
    const html = renderBusinessHandoffHtml(
      model({
        handoff_findings: [],
      }),
    );
    expect(html).toContain('本次审核无需要业务在发布环节额外处理的事项');
  });

  it('renders ineligibility page instead of empty export for blocked REVIEW', () => {
    const html = renderBusinessHandoffHtml(
      model({
        business_handoff: {
          eligible: false,
          code: 'REVIEW_MANUAL_CONTEXT',
          reasons: ['manual finding'],
        },
      }),
    );
    expect(html).toContain('本案例暂不可导出业务提醒摘要');
    expect(html).toContain('REVIEW_MANUAL_CONTEXT');
    expect(html).toContain('manual finding');
  });

  it('legal audit includes thread order and evidence disclosure rules', () => {
    const parent = baseCase({
      case_id: 'case_root',
      thread_id: 'case_root',
      created_at: '2026-07-16T00:00:00.000Z',
      decision: {
        ...baseCase().decision,
        final_decision: 'WARN',
        ai_decision: 'WARN',
        rationale: 'first pass',
      },
    });
    const child = baseCase({
      case_id: 'case_child',
      thread_id: 'case_root',
      parent_case_id: 'case_root',
      created_at: '2026-07-17T00:00:00.000Z',
      decision: {
        ...baseCase().decision,
        final_decision: 'PASS',
        rationale: 'resubmit pass',
      },
    });

    const html = renderLegalAuditHtml(
      model({
        template: 'legal_audit',
        case: child,
        thread_cases: [parent, child],
        evidence_links: [
          {
            link_id: 'l1',
            case_id: 'case_child',
            review_id: 'review_a',
            finding_id: 'f-ev',
            evidence_id: 'ev1',
            status: 'HUMAN_CONFIRMED',
            created_at: '2026-07-17T00:00:00.000Z',
            confirmed_at: '2026-07-17T00:10:00.000Z',
            ai_judgment: {
              relevance: 'strong',
              relevance_reasoning: 'matches claim',
              sufficiency: 'sufficient',
              sufficiency_reasoning: 'covers capacity',
              extracted_key_facts: 'capacity 2000Pa verified',
              judged_at: '2026-07-17T00:05:00.000Z',
            },
            evidence: {
              evidence_id: 'ev1',
              title: 'Lab report',
              evidence_source_type: 'THIRD_PARTY_LAB',
              claim_risk_types: [],
              scope: {},
              file: {
                filename: 'lab.pdf',
                mime_type: 'application/pdf',
                storage_path: 'files/lab.pdf',
              },
              created_at: '2026-07-17T00:00:00.000Z',
            },
          },
          {
            link_id: 'l2',
            case_id: 'case_child',
            review_id: 'review_a',
            finding_id: 'f-ev2',
            evidence_id: 'ev2',
            status: 'AI_JUDGED_PENDING_CONFIRMATION',
            created_at: '2026-07-17T00:00:00.000Z',
            ai_judgment: {
              relevance: 'none',
              relevance_reasoning: 'out of scope',
              sufficiency: 'insufficient',
              sufficiency_reasoning: 'n/a',
              extracted_key_facts: 'secret raw bytes should not appear',
              prescreen_excluded: true,
              judged_at: '2026-07-17T00:05:00.000Z',
            },
            evidence: {
              evidence_id: 'ev2',
              title: 'Internal note',
              evidence_source_type: 'INTERNAL_TEST',
              claim_risk_types: [],
              scope: {},
              file: {
                filename: 'note.txt',
                mime_type: 'text/plain',
                storage_path: 'files/note.txt',
              },
              created_at: '2026-07-17T00:00:00.000Z',
            },
          },
        ],
      }),
    );

    expect(html).toContain('case_root');
    expect(html).toContain('case_child');
    expect(html.indexOf('case_root')).toBeLessThan(html.indexOf('case_child（当前）'));
    expect(html).toContain('capacity 2000Pa verified');
    expect(html).toContain('仅元数据');
    expect(html).not.toContain('secret raw bytes should not appear');
    expect(html).not.toContain('files/lab.pdf');
  });
});
