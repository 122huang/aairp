import type { CaseReviewContext } from '../case/case-review-context.js';
import type { ReviewDecisionResult } from '../decision/review-decision.js';
import type { CaseFinding } from '../findings/case-finding.js';
import type { PriorFindingsSummary } from '../findings/llm-finding.js';
import type { OpenRiskDiscoveryResult } from '../findings/llm-finding.js';
import type { PlaybookEvaluationResult } from '../findings/playbook-finding.js';
import type { RuleEvaluationResult } from '../findings/rule-finding.js';
import type { ReviewReportResult } from '../report/review-report.js';

export type ReviewPipelineTimings = {
  ruleMs: number;
  playbookMs: number;
  openRiskMs: number;
  decisionMs: number;
  reportMs: number;
  totalMs: number;
};

export type ReviewPipelineEvaluationResult = {
  ruleResult: RuleEvaluationResult;
  playbookResult: PlaybookEvaluationResult;
  openRiskResult: OpenRiskDiscoveryResult;
  decision: ReviewDecisionResult;
  timings: ReviewPipelineTimings;
};

export type ReviewPipelineReportResult = ReviewPipelineEvaluationResult & {
  report: ReviewReportResult;
};

export function buildPriorFindingsSummary(
  ruleResult: RuleEvaluationResult,
  playbookResult: PlaybookEvaluationResult,
  options?: { caseReviewContext?: CaseReviewContext; caseFindings?: CaseFinding[] },
): PriorFindingsSummary {
  return {
    hasBlocker: ruleResult.hasBlocker,
    ruleFindings: ruleResult.findings.map((finding) => ({
      refId: finding.refId,
      summary: finding.summary,
      severity: finding.severity,
      decision: finding.decision,
    })),
    playbookFindings: playbookResult.findings.map((finding) => ({
      refId: finding.refId,
      summary: finding.summary,
      decision: finding.decision,
    })),
    ...(options?.caseReviewContext ? { caseReviewContext: options.caseReviewContext } : {}),
    ...(options?.caseFindings ? { caseFindings: options.caseFindings } : {}),
  };
}
