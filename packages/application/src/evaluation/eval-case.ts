import type {
  BenchmarkFindingRef,
  BenchmarkGroundTruth,
  EvalCaseActual,
  EvalCaseResult,
} from './benchmark-types.js';
import type { ReviewPipelineReportResult } from '@aairp/shared-kernel';

function collectFindingRefs(pipeline: ReviewPipelineReportResult): BenchmarkFindingRef[] {
  const refs: BenchmarkFindingRef[] = [];

  for (const finding of pipeline.ruleResult.findings) {
    refs.push({ module: 'RULE', ref_id: finding.refId });
  }
  for (const finding of pipeline.playbookResult.findings) {
    refs.push({ module: 'PLAYBOOK', ref_id: finding.refId });
  }
  for (const finding of pipeline.openRiskResult.findings) {
    refs.push({ module: 'LLM', ref_id: finding.refId });
  }

  return refs;
}

function hasFindingRef(refs: BenchmarkFindingRef[], expected: BenchmarkFindingRef): boolean {
  return refs.some(
    (ref) => ref.module === expected.module && ref.ref_id === expected.ref_id,
  );
}

function formatFindingRefs(refs: BenchmarkFindingRef[]): string {
  if (refs.length === 0) {
    return '(none)';
  }
  return refs.map((ref) => `${ref.module}/${ref.ref_id}`).join(', ');
}

export function buildEvalCaseActual(pipeline: ReviewPipelineReportResult): EvalCaseActual {
  return {
    final_decision: pipeline.decision.finalDecision,
    finding_refs: collectFindingRefs(pipeline),
    open_risk_skipped: pipeline.openRiskResult.skipped,
    rationale: pipeline.decision.rationale,
  };
}

export function compareEvalCase(
  caseId: string,
  description: string,
  tags: string[],
  expected: BenchmarkGroundTruth,
  actual: EvalCaseActual,
): EvalCaseResult {
  const failures: string[] = [];

  if (actual.final_decision !== expected.expected_decision) {
    failures.push(
      `decision mismatch: expected ${expected.expected_decision}, got ${actual.final_decision}`,
    );
  }

  for (const expectedFinding of expected.expected_findings ?? []) {
    if (!hasFindingRef(actual.finding_refs, expectedFinding)) {
      failures.push(
        `missing expected finding: ${expectedFinding.module}/${expectedFinding.ref_id}`,
      );
    }
  }

  for (const forbiddenRef of expected.must_not_include_refs ?? []) {
    if (actual.finding_refs.some((ref) => ref.ref_id === forbiddenRef)) {
      failures.push(`unexpected finding ref: ${forbiddenRef}`);
    }
  }

  if (
    expected.open_risk_skipped !== undefined &&
    actual.open_risk_skipped !== expected.open_risk_skipped
  ) {
    failures.push(
      `open_risk_skipped mismatch: expected ${expected.open_risk_skipped}, got ${actual.open_risk_skipped}`,
    );
  }

  if (failures.length > 0) {
    failures.push(`actual findings: ${formatFindingRefs(actual.finding_refs)}`);
    failures.push(`rationale: ${actual.rationale}`);
  }

  return {
    case_id: caseId,
    description,
    tags,
    passed: failures.length === 0,
    expected,
    actual,
    failures,
  };
}

export { collectFindingRefs, formatFindingRefs };
