import type {
  CaseFinding,
  ConsistencyFinding,
  DecisionFusionInput,
  FinalDecision,
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
  consistencyFindings?: ConsistencyFinding[];
  caseFindings?: CaseFinding[];
};

const DECISION_ORDER: Record<FinalDecision, number> = {
  PASS: 0,
  WARN: 1,
  REVIEW: 2,
  REJECT: 3,
};

function maxDecision(a: FinalDecision, b: FinalDecision): FinalDecision {
  return DECISION_ORDER[a] >= DECISION_ORDER[b] ? a : b;
}

export function computeCombinedHasBlocker(sources: {
  ruleHasBlocker: boolean;
  visionFindings?: VisionFinding[];
}): boolean {
  return sources.ruleHasBlocker || visionFindingHasBlocker(sources.visionFindings ?? []);
}

function formatFindingLabel(
  finding: RuleFinding | PlaybookFinding | LlmFinding | CaseFinding | VisionFinding | ConsistencyFinding,
): string {
  return `${finding.module}/${finding.refId} (${finding.severity})`;
}

function isInformationalRuleDecision(decision: RuleFinding['decision']): boolean {
  return decision === 'INFO' || decision === 'PASS';
}

function summarizeTopFindings(sources: DecisionFusionSources, limit = 3): string[] {
  const caseFindings = sources.caseFindings ?? [];
  const visionFindings = sources.visionFindings ?? [];
  const consistencyFindings = sources.consistencyFindings ?? [];
  const ranked = [
    ...sources.ruleFindings.filter((finding) => finding.severity === 'BLOCKER'),
    ...visionFindings.filter((finding) => finding.severity === 'BLOCKER'),
    ...sources.ruleFindings.filter(
      (finding) => finding.severity !== 'BLOCKER' && !isInformationalRuleDecision(finding.decision),
    ),
    ...consistencyFindings,
    ...caseFindings.filter((finding) => finding.decision === 'WARN'),
    ...sources.playbookFindings,
    ...sources.llmFindings,
    ...visionFindings.filter((finding) => finding.severity !== 'BLOCKER'),
    ...caseFindings.filter((finding) => finding.decision === 'PASS'),
    ...sources.ruleFindings.filter((finding) => isInformationalRuleDecision(finding.decision)),
  ];

  return ranked.slice(0, limit).map(formatFindingLabel);
}

function computeTextBranchVerdict(input: DecisionFusionInput): FinalDecision {
  if (input.hasBlocker) {
    return 'REJECT';
  }
  if (
    input.hasRuleReview ||
    input.hasPlaybookReviewSignal ||
    input.hasLlmManualReviewSignal
  ) {
    return 'REVIEW';
  }
  if (
    input.hasRuleWarn ||
    input.hasPlaybookConditionalSignal ||
    input.hasCaseConfirmedSignal ||
    input.playbookFindingCount > 0 ||
    input.llmFindingCount > 0 ||
    input.caseFindingCount > 0
  ) {
    return 'WARN';
  }
  return 'PASS';
}

function computeImageBranchVerdict(
  visionFindings: VisionFinding[],
  hasBlocker: boolean,
): FinalDecision {
  if (hasBlocker && visionFindingHasBlocker(visionFindings)) {
    return 'REJECT';
  }
  if (
    visionFindings.some(
      (finding) =>
        finding.decision === 'REVIEW' ||
        finding.evaluationDetail?.suggestedAction === 'MANUAL_REVIEW',
    )
  ) {
    return 'REVIEW';
  }
  if (visionFindings.some((finding) => finding.decision === 'WARN' || finding.decision === 'FAIL')) {
    return 'WARN';
  }
  return 'PASS';
}

function computeConsistencyBranchVerdict(consistencyFindings: ConsistencyFinding[]): FinalDecision {
  if (consistencyFindings.some((finding) => finding.decision === 'WARN')) {
    return 'WARN';
  }
  return 'PASS';
}

export function buildBranchVerdicts(
  input: DecisionFusionInput,
  sources: DecisionFusionSources,
): import('@aairp/shared-kernel').BranchVerdicts {
  const visionFindings = sources.visionFindings ?? [];
  const consistencyFindings = sources.consistencyFindings ?? [];
  return {
    text: computeTextBranchVerdict(input),
    image: computeImageBranchVerdict(visionFindings, input.hasBlocker),
    consistency: computeConsistencyBranchVerdict(consistencyFindings),
  };
}

function hasElevatingWarnSignal(input: DecisionFusionInput): boolean {
  return (
    input.hasRuleWarn ||
    input.hasPlaybookConditionalSignal ||
    input.hasCaseConfirmedSignal ||
    input.playbookFindingCount > 0 ||
    input.llmFindingCount > 0 ||
    input.caseFindingCount > 0 ||
    input.visionFindingCount > 0 ||
    Boolean(input.hasConsistencyWarn)
  );
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

  const hasReviewSignal =
    input.hasRuleReview ||
    input.hasPlaybookReviewSignal ||
    input.hasLlmManualReviewSignal ||
    input.hasVisionManualReviewSignal;

  if (hasReviewSignal) {
    const summary =
      topFindings.length > 0 ? topFindings.join('; ') : 'manual-review signals detected';
    return `Manual review required based on: ${summary}. Route to product compliance / legal before publishing.`;
  }

  if (hasElevatingWarnSignal(input)) {
    const summary =
      topFindings.length > 0 ? topFindings.join('; ') : 'non-blocking findings detected';
    return `Warning issued based on: ${summary}. Manual follow-up recommended before publishing.`;
  }

  const infoFindings = sources.ruleFindings.filter((finding) => finding.decision === 'INFO');
  if (infoFindings.length > 0) {
    const summary = infoFindings.slice(0, 3).map(formatFindingLabel).join('; ');
    return `Passed with informational notices: ${summary}. These do not block publish; confirm registration/certification or related obligations offline where noted.`;
  }

  return 'No blocking or warning findings across Rule, Playbook, Case, Open Risk, Vision, or Consistency modules.';
}

export function buildDecisionFusionInput(sources: DecisionFusionSources): DecisionFusionInput {
  const caseFindings = sources.caseFindings ?? [];
  const visionFindings = sources.visionFindings ?? [];
  const consistencyFindings = sources.consistencyFindings ?? [];

  return {
    reviewId: sources.reviewId,
    hasBlocker: sources.hasBlocker,
    ruleFindingCount: sources.ruleFindings.length,
    playbookFindingCount: sources.playbookFindings.length,
    llmFindingCount: sources.llmFindings.length,
    caseFindingCount: caseFindings.filter((finding) => finding.decision === 'WARN').length,
    visionFindingCount: visionFindings.length,
    consistencyFindingCount: consistencyFindings.length,
    hasRuleWarn: sources.ruleFindings.some(
      (finding) => finding.decision === 'WARN' || finding.decision === 'FAIL',
    ),
    hasRuleReview: sources.ruleFindings.some((finding) => finding.decision === 'REVIEW'),
    hasPlaybookReviewSignal: sources.playbookFindings.some(
      (finding) => finding.decision === 'REVIEW',
    ),
    hasPlaybookConditionalSignal: sources.playbookFindings.some(
      (finding) => finding.decision === 'CONDITIONAL',
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
    hasConsistencyWarn: consistencyFindings.some((finding) => finding.decision === 'WARN'),
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
    const rationaleSources = sources ?? {
      reviewId: input.reviewId,
      countryId: undefined,
      hasBlocker: input.hasBlocker,
      ruleFindings: [],
      playbookFindings: [],
      llmFindings: [],
      visionFindings: [],
      consistencyFindings: [],
      caseFindings: [],
    };
    const branchVerdicts = buildBranchVerdicts(input, rationaleSources);
    const findingCounts = {
      rule: input.ruleFindingCount,
      playbook: input.playbookFindingCount,
      llm: input.llmFindingCount,
      case: input.caseFindingCount,
      vision: input.visionFindingCount,
      ...((input.consistencyFindingCount ?? 0) > 0
        ? { consistency: input.consistencyFindingCount }
        : {}),
    };

    if (input.hasBlocker) {
      return {
        reviewId: input.reviewId,
        finalDecision: 'REJECT',
        confidence: 1,
        rationale: buildDecisionRationale(input, rationaleSources),
        findingCounts,
        branchVerdicts,
        decidedAt,
      };
    }

    const hasReviewSignal =
      input.hasRuleReview ||
      input.hasPlaybookReviewSignal ||
      input.hasLlmManualReviewSignal ||
      input.hasVisionManualReviewSignal;

    if (hasReviewSignal) {
      const confidence = applyCountryConfidenceModifier(0.78, rationaleSources.countryId ?? '');
      return {
        reviewId: input.reviewId,
        finalDecision: 'REVIEW',
        confidence,
        rationale: buildDecisionRationale(input, rationaleSources),
        findingCounts,
        branchVerdicts,
        decidedAt,
      };
    }

    const hasAnyFinding =
      input.ruleFindingCount > 0 ||
      input.playbookFindingCount > 0 ||
      input.llmFindingCount > 0 ||
      input.caseFindingCount > 0 ||
      input.visionFindingCount > 0 ||
      (input.consistencyFindingCount ?? 0) > 0;

    if (input.hasRuleWarn || hasAnyFinding) {
      let confidence = 0.75;
      if (input.hasRuleWarn) {
        confidence = 0.9;
      } else if (input.hasCaseConfirmedSignal) {
        confidence = 0.82;
      } else if (input.hasPlaybookConditionalSignal) {
        confidence = 0.78;
      }

      if (!hasElevatingWarnSignal(input)) {
        return {
          reviewId: input.reviewId,
          finalDecision: 'PASS',
          confidence: 0.95,
          rationale: buildDecisionRationale(input, rationaleSources),
          findingCounts,
          branchVerdicts,
          decidedAt,
        };
      }

      confidence = applyCountryConfidenceModifier(
        confidence,
        rationaleSources.countryId ?? '',
      );

      const finalDecision = maxDecision(
        maxDecision(branchVerdicts.text, branchVerdicts.image),
        branchVerdicts.consistency,
      );

      return {
        reviewId: input.reviewId,
        finalDecision,
        confidence,
        rationale: buildDecisionRationale(input, rationaleSources),
        findingCounts,
        branchVerdicts,
        decidedAt,
      };
    }

    return {
      reviewId: input.reviewId,
      finalDecision: 'PASS',
      confidence: 0.95,
      rationale: buildDecisionRationale(input, rationaleSources),
      findingCounts,
      branchVerdicts,
      decidedAt,
    };
  }
}

export { confidenceBand };
