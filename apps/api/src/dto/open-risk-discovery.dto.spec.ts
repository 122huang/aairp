import { describe, expect, it } from 'vitest';
import { toOpenRiskDiscoveryResponseDto } from './open-risk-discovery.dto.js';

describe('open-risk-discovery.dto', () => {
  it('maps OpenRiskDiscoveryResult to snake_case response', () => {
    const dto = toOpenRiskDiscoveryResponseDto({
      reviewId: 'rev_test',
      promptPackVersion: 'demo-open-risk-1.0.0',
      skipped: false,
      evaluatedAt: '2026-06-26T10:08:00.000Z',
      findings: [
        {
          module: 'LLM',
          findingId: 'lf_test',
          severity: 'MEDIUM',
          decision: 'WARN',
          refType: 'LLM_RISK',
          refId: 'combined-misleading-claim',
          refVersionId: 'demo-open-risk-1.0.0-combined-misleading-claim-v1',
          summary: 'Combining urgency language with disease-related efficacy claims may mislead consumers.',
          confidence: 0.72,
          evaluationDetail: {
            riskType: 'combined-misleading-claim',
            suggestedAction: 'WARN',
            evidenceSpans: [{ field: 'text', start: 0, end: 17, text: 'Clinically proven' }],
            relatedModulesChecked: ['demo-sg-health-forbidden-claim'],
          },
        },
      ],
    });

    expect(dto).toEqual({
      review_id: 'rev_test',
      prompt_pack_version: 'demo-open-risk-1.0.0',
      skipped: false,
      evaluated_at: '2026-06-26T10:08:00.000Z',
      findings: [
        {
          finding_id: 'lf_test',
          module: 'LLM',
          severity: 'MEDIUM',
          decision: 'WARN',
          ref_type: 'LLM_RISK',
          ref_id: 'combined-misleading-claim',
          ref_version_id: 'demo-open-risk-1.0.0-combined-misleading-claim-v1',
          summary:
            'Combining urgency language with disease-related efficacy claims may mislead consumers.',
          confidence: 0.72,
          evaluation_detail: {
            risk_type: 'combined-misleading-claim',
            suggested_action: 'WARN',
            evidence_spans: [{ field: 'text', start: 0, end: 17, text: 'Clinically proven' }],
            related_modules_checked: ['demo-sg-health-forbidden-claim'],
          },
        },
      ],
    });
  });

  it('maps skipped open risk discovery response', () => {
    const dto = toOpenRiskDiscoveryResponseDto({
      reviewId: 'rev_test',
      promptPackVersion: 'demo-open-risk-1.0.0',
      skipped: true,
      skipReason: 'HAS_BLOCKER',
      evaluatedAt: '2026-06-26T10:08:00.000Z',
      findings: [],
    });

    expect(dto).toEqual({
      review_id: 'rev_test',
      prompt_pack_version: 'demo-open-risk-1.0.0',
      skipped: true,
      skip_reason: 'HAS_BLOCKER',
      evaluated_at: '2026-06-26T10:08:00.000Z',
      findings: [],
    });
  });
});
