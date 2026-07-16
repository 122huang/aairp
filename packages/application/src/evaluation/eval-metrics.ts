import { isLegalReviewedMarket } from '@aairp/shared-kernel';
import type {
  BenchmarkGroundTruth,
  EvalCaseResult,
  EvalMarketTierMetrics,
  EvalMetrics,
} from './benchmark-types.js';

function isBlockerExpected(groundTruth: BenchmarkGroundTruth): boolean {
  return groundTruth.expected_decision === 'REJECT';
}

function expectedFindingKeys(results: EvalCaseResult[]): Set<string> {
  const keys = new Set<string>();
  for (const result of results) {
    for (const finding of result.expected.expected_findings ?? []) {
      keys.add(`${finding.module}:${finding.ref_id}`);
    }
  }
  return keys;
}

function computeMarketTierMetrics(
  caseResults: EvalCaseResult[],
  matchesTier: (countryId: string) => boolean,
): EvalMarketTierMetrics {
  // Case tags are built as [country_id, category_id, ...] by both dataset and ad-manifest
  // benchmark evaluators — tags[0] is the country code. Cases without a recognizable
  // country tag are excluded from both tiers rather than guessed into either bucket.
  const tierCases = caseResults.filter((result) => {
    const countryId = result.tags[0];
    return typeof countryId === 'string' && countryId.length > 0 && matchesTier(countryId);
  });
  const passed = tierCases.filter((result) => result.passed).length;
  const decisionCorrect = tierCases.filter(
    (result) => result.actual.final_decision === result.expected.expected_decision,
  ).length;

  return {
    total_cases: tierCases.length,
    passed_cases: passed,
    decision_accuracy: tierCases.length === 0 ? 1 : decisionCorrect / tierCases.length,
    country_ids: Array.from(new Set(tierCases.map((result) => result.tags[0]!.toUpperCase()))).sort(),
  };
}

export function computeEvalMetrics(caseResults: EvalCaseResult[]): EvalMetrics {
  const total = caseResults.length;
  const passed = caseResults.filter((result) => result.passed).length;
  const failed = total - passed;

  const decisionCorrect = caseResults.filter(
    (result) => result.actual.final_decision === result.expected.expected_decision,
  ).length;
  const decision_accuracy = total === 0 ? 1 : decisionCorrect / total;

  const blockerCases = caseResults.filter((result) => isBlockerExpected(result.expected));
  const blockerCorrect = blockerCases.filter(
    (result) => result.actual.final_decision === 'REJECT',
  ).length;
  const blocker_recall =
    blockerCases.length === 0 ? 1 : blockerCorrect / blockerCases.length;

  const nonRejectExpected = caseResults.filter(
    (result) => result.expected.expected_decision !== 'REJECT',
  );
  const falseRejects = nonRejectExpected.filter(
    (result) => result.actual.final_decision === 'REJECT',
  ).length;
  const false_reject_rate =
    nonRejectExpected.length === 0 ? 0 : falseRejects / nonRejectExpected.length;

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  const expectedKeys = expectedFindingKeys(caseResults);

  for (const result of caseResults) {
    const actualKeys = new Set(
      result.actual.finding_refs.map((ref) => `${ref.module}:${ref.ref_id}`),
    );
    const expectedForCase = new Set(
      (result.expected.expected_findings ?? []).map(
        (ref) => `${ref.module}:${ref.ref_id}`,
      ),
    );

    for (const key of expectedForCase) {
      if (actualKeys.has(key)) {
        truePositives += 1;
      } else {
        falseNegatives += 1;
      }
    }

    for (const key of actualKeys) {
      if (expectedKeys.has(key) && !expectedForCase.has(key)) {
        falsePositives += 1;
      }
    }
  }

  const finding_precision =
    truePositives + falsePositives === 0
      ? 1
      : truePositives / (truePositives + falsePositives);
  const finding_recall =
    truePositives + falseNegatives === 0
      ? 1
      : truePositives / (truePositives + falseNegatives);
  const finding_f1 =
    finding_precision + finding_recall === 0
      ? 0
      : (2 * finding_precision * finding_recall) / (finding_precision + finding_recall);

  return {
    total_cases: total,
    passed_cases: passed,
    failed_cases: failed,
    decision_accuracy,
    blocker_recall,
    false_reject_rate,
    finding_precision,
    finding_recall,
    finding_f1,
    legal_reviewed_markets: computeMarketTierMetrics(caseResults, (countryId) =>
      isLegalReviewedMarket(countryId),
    ),
    unreviewed_markets: computeMarketTierMetrics(
      caseResults,
      (countryId) => !isLegalReviewedMarket(countryId),
    ),
  };
}

export function formatMetricPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
