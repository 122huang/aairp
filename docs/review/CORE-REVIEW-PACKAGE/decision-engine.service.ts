import type {
  CaseFinding,
  DecisionFusionInput,
  LlmFinding,
  PlaybookFinding,
  ReviewDecisionResult,
  RuleFinding,
} from '@aairp/shared-kernel';

export type DecisionEngineConfig = {
  now?: () => Date;
};

export type DecisionFusionSources = {
  reviewId: string;
  hasBlocker: boolean;
  ruleFindings: RuleFinding[];
  playbookFindings: PlaybookFinding[];
  llmFindings: LlmFinding[];
  caseFindings?: CaseFinding[];
};

function formatFindingLabel(
  finding: RuleFinding | PlaybookFinding | LlmFinding | CaseFinding,
): string {
  return `${finding.module}/${finding.refId} (${finding.severity})`;
}

function summarizeTopFindings(sources: DecisionFusionSources, limit = 3): string[] {
  const caseFindings = sources.caseFindings ?? [];
  const ranked = [
    ...sources.ruleFindings.filter((finding) => finding.severity === 'BLOCKER'),
    ...sources.ruleFindings.filter((finding) => finding.severity !== 'BLOCKER'),
    ...caseFindings.filter((finding) => finding.decision === 'WARN'),
    ...sources.playbookFindings,
    ...sources.llmFindings,
    ...caseFindings.filter((finding) => finding.decision === 'PASS'),
  ];

  return ranked.slice(0, limit).map(formatFindingLabel);
}

export function buildDecisionRationale(
  input: DecisionFusionInput,
  sources: DecisionFusionSources,
): string {
  const topFindings = summarizeTopFindings(sources);

  if (input.hasBlocker) {
    const blocker = sources.ruleFindings.find((finding) => finding.severity === 'BLOCKER');
    const blockerLabel = blocker ? formatFindingLabel(blocker) : 'Rule BLOCKER';
    return `Rejected due to blocking rule finding: ${blockerLabel}.`;
  }

  const hasAnyFinding =
    input.ruleFindingCount > 0 ||
    input.playbookFindingCount > 0 ||
    input.llmFindingCount > 0 ||
    input.caseFindingCount > 0;

  if (hasAnyFinding) {
    const summary =
      topFindings.length > 0 ? topFindings.join('; ') : 'non-blocking findings detected';
    return `Warning issued based on: ${summary}. Manual follow-up recommended before publishing.`;
  }

  return 'No blocking or warning findings across Rule, Playbook, Case, or Open Risk modules.';
}

export function buildDecisionFusionInput(sources: DecisionFusionSources): DecisionFusionInput {
  const caseFindings = sources.caseFindings ?? [];

  return {
    reviewId: sources.reviewId,
    hasBlocker: sources.hasBlocker,
    ruleFindingCount: sources.ruleFindings.length,
    playbookFindingCount: sources.playbookFindings.length,
    llmFindingCount: sources.llmFindings.length,
    caseFindingCount: caseFindings.filter((finding) => finding.decision === 'WARN').length,
    hasRuleWarn: sources.ruleFindings.some(
      (finding) => finding.decision === 'WARN' || finding.decision === 'FAIL',
    ),
    hasPlaybookReviewSignal: sources.playbookFindings.some(
      (finding) => finding.decision === 'REVIEW' || finding.decision === 'CONDITIONAL',
    ),
    hasLlmManualReviewSignal: sources.llmFindings.some(
      (finding) =>
        finding.decision === 'REVIEW' ||
        finding.evaluationDetail?.suggestedAction === 'MANUAL_REVIEW',
    ),
    hasCaseConfirmedSignal: caseFindings.some(
      (finding) =>
        finding.decision === 'WARN' &&
        finding.evaluationDetail.lifecycleStatus === 'CONFIRMED',
    ),
  };
}

function confidenceBand(confidence: number): string {
  if (confidence >= 0.9) {
    return 'High';
  }
  if (confidence >= 0.75) {
    return 'Medium';
  }
  return 'Low';
}

export class DecisionEngineService {
  constructor(private readonly config: DecisionEngineConfig = {}) {}

  fuseFromFindings(sources: DecisionFusionSources): ReviewDecisionResult {
    return this.fuse(buildDecisionFusionInput(sources), sources);
  }

  fuse(input: DecisionFusionInput, sources?: DecisionFusionSources): ReviewDecisionResult {
    const decidedAt = (this.config.now ?? (() => new Date()))().toISOString();
    const findingCounts = {
      rule: input.ruleFindingCount,
      playbook: input.playbookFindingCount,
      llm: input.llmFindingCount,
      case: input.caseFindingCount,
    };
    const rationaleSources = sources ?? {
      reviewId: input.reviewId,
      hasBlocker: input.hasBlocker,
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [],
      caseFindings: [],
    };

    if (input.hasBlocker) {
      return {
        reviewId: input.reviewId,
        finalDecision: 'REJECT',
        confidence: 1,
        rationale: buildDecisionRationale(input, rationaleSources),
        findingCounts,
        decidedAt,
      };
    }

    const hasAnyFinding =
      input.ruleFindingCount > 0 ||
      input.playbookFindingCount > 0 ||
      input.llmFindingCount > 0 ||
      input.caseFindingCount > 0;

    if (input.hasRuleWarn || hasAnyFinding) {
      let confidence = 0.75;
      if (input.hasRuleWarn) {
        confidence = 0.9;
      } else if (input.hasCaseConfirmedSignal) {
        confidence = 0.82;
      } else if (input.hasPlaybookReviewSignal || input.hasLlmManualReviewSignal) {
        confidence = 0.78;
      }

      const hasWarnSignal =
        input.hasRuleWarn ||
        input.hasPlaybookReviewSignal ||
        input.hasLlmManualReviewSignal ||
        input.hasCaseConfirmedSignal ||
        input.playbookFindingCount > 0 ||
        input.llmFindingCount > 0 ||
        input.caseFindingCount > 0;

      if (!hasWarnSignal) {
        return {
          reviewId: input.reviewId,
          finalDecision: 'PASS',
          confidence: 0.95,
          rationale: buildDecisionRationale(input, rationaleSources),
          findingCounts,
          decidedAt,
        };
      }

      return {
        reviewId: input.reviewId,
        finalDecision: 'WARN',
        confidence,
        rationale: buildDecisionRationale(input, rationaleSources),
        findingCounts,
        decidedAt,
      };
    }

    return {
      reviewId: input.reviewId,
      finalDecision: 'PASS',
      confidence: 0.95,
      rationale: buildDecisionRationale(input, rationaleSources),
      findingCounts,
      decidedAt,
    };
  }
}

export { confidenceBand };
