import type { FindingDecision, FindingSeverity, ModuleFinding } from './finding-types.js';

/** Structured fields extracted from a single image slice (ADR-005 §6.1). */
export type AssetFieldExtract = {
  sliceId: string;
  sourceImageIndex: number;
  sliceIndex: number;
  modelTokens?: string[];
  capacity?: string[];
  material?: string[];
  voltage?: string[];
  languagesOnPanel?: string[];
  certificationMarks?: string[];
  /** Free-form claim magnitudes (e.g. 112kPa) kept for pressure / power diffs. */
  quantitativeClaims?: string[];
};

export type ConsistencyFinding = ModuleFinding & {
  module: 'CONSISTENCY';
  refType: 'CONSISTENCY_FIELD';
  evaluationDetail: {
    field: string;
    conflict: string;
    slicesInvolved: string[];
    values: string[];
  };
};

export type ConsistencyDiscoveryResult = {
  reviewId: string;
  fieldExtracts: AssetFieldExtract[];
  findings: ConsistencyFinding[];
  skipped: boolean;
  skipReason?: 'SINGLE_SLICE' | 'NO_EXTRACTS' | 'VISION_SKIPPED';
  evaluatedAt: string;
};

export function createConsistencyFinding(input: {
  findingId: string;
  field: string;
  conflict: string;
  slicesInvolved: string[];
  values: string[];
  severity?: FindingSeverity;
  decision?: FindingDecision;
  confidence?: number;
  promptPackVersion?: string;
}): ConsistencyFinding {
  const severity = input.severity ?? 'MEDIUM';
  return {
    module: 'CONSISTENCY',
    findingId: input.findingId,
    severity,
    decision: input.decision ?? 'WARN',
    refType: 'CONSISTENCY_FIELD',
    refId: `cross-slice-${input.field}`,
    refVersionId: `${input.promptPackVersion ?? 'demo-consistency-1.0.0'}-${input.field}-v1`,
    summary: input.conflict,
    confidence: input.confidence ?? 0.88,
    evaluationDetail: {
      field: input.field,
      conflict: input.conflict,
      slicesInvolved: input.slicesInvolved,
      values: input.values,
    },
  };
}
