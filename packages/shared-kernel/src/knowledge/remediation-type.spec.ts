import { describe, expect, it } from 'vitest';
import {
  resolveFindingRemediationType,
  remediationTypeFromRiskType,
  supportsEvidenceAttachment,
} from './remediation-type.js';

describe('remediationTypeFromRiskType', () => {
  it('maps comparative / performance / capacity family to EVIDENCE_SUPPLEMENT', () => {
    expect(remediationTypeFromRiskType('unsupported-comparative-claim')).toBe(
      'EVIDENCE_SUPPLEMENT',
    );
    expect(remediationTypeFromRiskType('sa-comparative-claim')).toBe('EVIDENCE_SUPPLEMENT');
    expect(remediationTypeFromRiskType('sa-performance-claim')).toBe('EVIDENCE_SUPPLEMENT');
    expect(remediationTypeFromRiskType('capacity-claim')).toBe('EVIDENCE_SUPPLEMENT');
    expect(remediationTypeFromRiskType('sa-capacity-claim')).toBe('EVIDENCE_SUPPLEMENT');
    expect(remediationTypeFromRiskType('unsubstantiated-quantitative-claim')).toBe(
      'EVIDENCE_SUPPLEMENT',
    );
  });

  it('returns undefined for non-whitelisted risk types', () => {
    expect(remediationTypeFromRiskType('urgency-cta')).toBeUndefined();
    expect(remediationTypeFromRiskType('sponsored-disclosure')).toBeUndefined();
    expect(remediationTypeFromRiskType(undefined)).toBeUndefined();
  });
});

describe('resolveFindingRemediationType', () => {
  it('prefers explicit RULE remediation_type over risk_type whitelist', () => {
    expect(
      resolveFindingRemediationType({
        remediationType: 'REWRITE_ONLY',
        riskType: 'unsupported-comparative-claim',
      }),
    ).toBe('REWRITE_ONLY');
  });

  it('falls back to risk_type for LLM / playbook findings without RULE tag', () => {
    expect(
      resolveFindingRemediationType({
        riskType: 'unsupported-comparative-claim',
        refId: 'llm-open-risk',
      }),
    ).toBe('EVIDENCE_SUPPLEMENT');
  });

  it('falls back to refId when risk_type is absent (playbook pattern id)', () => {
    expect(
      resolveFindingRemediationType({
        refId: 'sa-comparative-claim',
      }),
    ).toBe('EVIDENCE_SUPPLEMENT');
  });

  it('marks whitelisted findings as evidence-attachable', () => {
    const type = resolveFindingRemediationType({
      riskType: 'unsupported-comparative-claim',
    });
    expect(supportsEvidenceAttachment(type)).toBe(true);
  });
});
