import type {
  CaseFinding,
  DecisionFusionInput,
  LlmFinding,
  PlaybookFinding,
  ReviewDecisionResult,
  RuleFinding,
  VisionFinding,
} from '@aairp/shared-kernel';
import { visionFindingHasBlocker } from '@aairp/shared-kernel';

export type DecisionEngineConfig = {
  now?: () => Date;
};

export type DecisionFusionSources = {
  reviewId: string;
  countryId?: string;
  hasBlocker: boolean;
  ruleFindings: RuleFinding[];
  playbookFindings: PlaybookFinding[];
  llmFindings: LlmFinding[];
  visionFindings?: VisionFinding[];
  caseFindings?: CaseFinding[];
};

export function computeCombinedHasBlocker(sources: {
  ruleHasBlocker: boolean;
  visionFindings?: VisionFinding[];
}): boolean {
  return sources.ruleHasBlocker || visionFindingHasBlocker(sources.visionFindings ?? []);
}

function formatFindingLabel(
  finding: RuleFinding | PlaybookFinding | LlmFinding | CaseFinding | VisionFinding,
): string {
  return `${finding.module}/${finding.refId} (${finding.severity})`;
}

function summarizeTopFindings(sources: DecisionFusionSources, limit = 3): string[] {
  const caseFindings = sources.caseFindings ?? [];
  const visionFindings = sources.visionFindings ?? [];
  const ranked = [
    ...sources.ruleFindings.filter((finding) => finding.severity === 'BLOCKER'),
    ...visionFindings.filter((finding) => finding.severity === 'BLOCKER'),
    ...sources.ruleFindings.filter((finding) => finding.severity !== 'BLOCKER'),
    ...caseFindings.filter((finding) => finding.decision === 'WARN'),
    ...sources.playbookFindings,
    ...sources.llmFindings,
    ...visionFindings.filter((finding) => finding.severity !== 'BLOCKER'),
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
    const blocker =
      sources.ruleFindings.find((finding) => finding.severity === 'BLOCKER') ??
      (sources.visionFindings ?? []).find((finding) => finding.severity === 'BLOCKER');
    const blockerLabel = blocker ? formatFindingLabel(blocker) : 'BLOCKER finding';
    return `Rejected due to blocking finding: ${blockerLabel}.`;
  }

  const hasAnyFinding =
    input.ruleFindingCount > 0 ||
    input.playbookFindingCount > 0 ||
    input.llmFindingCount > 0 ||
    input.caseFindingCount > 0 ||
    input.visionFindingCount > 0;

  if (hasAnyFinding) {
    const summary =
      topFindings.length > 0 ? topFindings.join('; ') : 'non-blocking findings detected';
    return `Warning issued based on: ${summary}. Manual follow-up recommended before publishing.`;
  }

  return 'No blocking or warning findings across Rule, Playbook, Case, Open Risk, or Vision modules.';
}

export function buildDecisionFusionInput(sources: DecisionFusionSources): DecisionFusionInput {
  const caseFindings = sources.caseFindings ?? [];
  const visionFindings = sources.visionFindings ?? [];

  return {
    reviewId: sources.reviewId,
    hasBlocker: sources.hasBlocker,
    ruleFindingCount: sources.ruleFindings.length,
    playbookFindingCount: sources.playbookFindings.length,
    llmFindingCount: sources.llmFindings.length,
    caseFindingCount: caseFindings.filter((finding) => finding.decision === 'WARN').length,
    visionFindingCount: visionFindings.length,
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
    hasVisionManualReviewSignal: visionFindings.some(
      (finding) =>
        finding.decision === 'REVIEW' ||
        finding.evaluationDetail?.suggestedAction === 'MANUAL_REVIEW',
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

export function applyCountryConfidenceModifier(
  confidence: number,
  countryId: string,
): number {
  const modifiers: Record<string, number> = {
    PH: -0.1,
  };
  const delta = modifiers[countryId] ?? 0;
  return Math.min(1, Math.max(0, confidence + delta));
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
      vision: input.visionFindingCount,
    };
    const rationaleSources = sources ?? {
      reviewId: input.reviewId,
      countryId: undefined,
      hasBlocker: input.hasBlocker,
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [],
      visionFindings: [],
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
      input.caseFindingCount > 0 ||
      input.visionFindingCount > 0;

    if (input.hasRuleWarn || hasAnyFinding) {
      let confidence = 0.75;
      if (input.hasRuleWarn) {
        confidence = 0.9;
      } else if (input.hasCaseConfirmedSignal) {
        confidence = 0.82;
      } else if (
        input.hasPlaybookReviewSignal ||
        input.hasLlmManualReviewSignal ||
        input.hasVisionManualReviewSignal
      ) {
        confidence = 0.78;
      }

      const hasWarnSignal =
        input.hasRuleWarn ||
        input.hasPlaybookReviewSignal ||
        input.hasLlmManualReviewSignal ||
        input.hasVisionManualReviewSignal ||
        input.hasCaseConfirmedSignal ||
        input.playbookFindingCount > 0 ||
        input.llmFindingCount > 0 ||
        input.caseFindingCount > 0 ||
        input.visionFindingCount > 0;

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

      confidence = applyCountryConfidenceModifier(
        confidence,
        rationaleSources.countryId ?? '',
      );

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
