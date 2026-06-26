import { describe, expect, it } from 'vitest';
import { toPlaybookEvaluationResponseDto } from './playbook-evaluation.dto.js';

describe('playbook-evaluation.dto', () => {
  it('maps PlaybookEvaluationResult to snake_case response', () => {
    const dto = toPlaybookEvaluationResponseDto({
      reviewId: 'rev_test',
      playbookPackVersion: 'demo-playbook-1.0.0',
      evaluatedAt: '2026-06-26T10:07:00.000Z',
      findings: [
        {
          module: 'PLAYBOOK',
          findingId: 'pf_test',
          severity: 'MEDIUM',
          decision: 'WARN',
          refType: 'PLAYBOOK_PATTERN',
          refId: 'urgency-cta',
          refVersionId: 'demo-health-supplement-playbook-urgency-cta-v1',
          summary: 'Urgency CTAs should include offer validity or expiry date.',
          confidence: 0.85,
          evaluationDetail: {
            patternId: 'urgency-cta',
            checklistIds: [],
            guidance: 'Urgency CTAs should include offer validity or expiry date.',
            severityHint: 'MEDIUM',
            playbookDecision: 'WARN',
            typicalDecision: 'REVIEW',
            matchedSpans: [{ field: 'text', start: 0, end: 7, text: 'Buy now' }],
          },
        },
      ],
    });

    expect(dto).toEqual({
      review_id: 'rev_test',
      playbook_pack_version: 'demo-playbook-1.0.0',
      evaluated_at: '2026-06-26T10:07:00.000Z',
      findings: [
        {
          finding_id: 'pf_test',
          module: 'PLAYBOOK',
          severity: 'MEDIUM',
          decision: 'WARN',
          ref_type: 'PLAYBOOK_PATTERN',
          ref_id: 'urgency-cta',
          ref_version_id: 'demo-health-supplement-playbook-urgency-cta-v1',
          summary: 'Urgency CTAs should include offer validity or expiry date.',
          confidence: 0.85,
          evaluation_detail: {
            pattern_id: 'urgency-cta',
            checklist_ids: [],
            guidance: 'Urgency CTAs should include offer validity or expiry date.',
            severity_hint: 'MEDIUM',
            playbook_decision: 'WARN',
            typical_decision: 'REVIEW',
            matched_spans: [{ field: 'text', start: 0, end: 7, text: 'Buy now' }],
          },
        },
      ],
    });
  });
});
