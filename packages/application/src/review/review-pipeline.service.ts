import type {
  CaseFinding,
  CasePrecedent,
  CaseRetrievalResult,
  CaseReviewContext,
  ContextualRewriteBatchResult,
  ReviewContext,
  RuleEvaluationResult,
  RuleFinding,
  VisionDiscoveryResult,
} from '@aairp/shared-kernel';
import {
  buildPriorFindingsSummary,
  isCaseFindingsInDecisionEnabled,
  isCaseFirstEnabled,
  isCaseGroundLlmEnabled,
  isCaseInPlaybookEnabled,
  type ReviewPipelineEvaluationResult,
  type ReviewPipelineReportResult,
  type ReviewPipelineTimings,
} from '@aairp/shared-kernel';
import { CaseContextAssembler } from '../case/case-context-assembler.service.js';
import { CaseFindingGeneratorService } from '../case/case-finding-generator.service.js';
import { CaseRetrievalService } from '../case/case-retrieval.service.js';
import {
  ContextualRewriteService,
  type WarnFinding,
} from './contextual-rewrite.service.js';
import { mapWithConcurrency } from './async-concurrency.js';
import { joinVisionExtractedText } from './content-matching.js';
import { applyImageReadabilityGate } from './image-readability-gate.js';
import { DecisionEngineService, computeCombinedHasBlocker } from './decision-engine.service.js';
import { OpenRiskDiscoveryService } from './open-risk-discovery.service.js';
import { PlaybookEngineService } from './playbook-engine.service.js';
import { ReviewReportService } from './review-report.service.js';
import { RuleEngineService } from './rule-engine.service.js';
import { VisionComplianceService } from './vision-compliance.service.js';
import { resolveVisionLlmMode } from './vision-llm.gateway.js';

/** Merge post-vision rule hits without duplicating the same rule ref. */
export function mergeRuleEvaluationResults(
  primary: RuleEvaluationResult,
  secondary: RuleEvaluationResult,
): RuleEvaluationResult {
  const seen = new Set(primary.findings.map((finding) => finding.refId));
  const added: RuleFinding[] = [];
  for (const finding of secondary.findings) {
    if (!seen.has(finding.refId)) {
      seen.add(finding.refId);
      added.push(finding);
    }
  }
  if (added.length === 0) {
    return primary;
  }
  return {
    ...primary,
    findings: [...primary.findings, ...added],
    hasBlocker: primary.hasBlocker || secondary.hasBlocker,
  };
}

export function withVisionTextContext(
  context: ReviewContext,
  visionResult?: VisionDiscoveryResult,
): ReviewContext {
  const visionText = joinVisionExtractedText(visionResult?.extractedText);
  if (!visionText) {
    return context;
  }
  return {
    ...context,
    normalizedContent: {
      ...context.normalizedContent,
      visionText,
    },
  };
}

export type ReviewPipelineServiceDeps = {
  ruleEngineService: RuleEngineService;
  playbookEngineService: PlaybookEngineService;
  openRiskDiscoveryService: OpenRiskDiscoveryService;
  decisionEngineService: DecisionEngineService;
  reviewReportService: ReviewReportService;
  visionComplianceService?: VisionComplianceService;
  contextualRewriteService?: ContextualRewriteService;
  caseRetrievalService?: CaseRetrievalService;
  caseContextAssembler?: CaseContextAssembler;
  caseFindingGeneratorService?: CaseFindingGeneratorService;
};

type CaseStageResult = {
  caseRetrieval?: CaseRetrievalResult;
  caseReviewContext?: CaseReviewContext;
  caseFindings: CaseFinding[];
};

type EvaluationStageResult = {
  ruleResult: ReviewPipelineEvaluationResult['ruleResult'];
  playbookResult: ReviewPipelineEvaluationResult['playbookResult'];
  openRiskResult: ReviewPipelineEvaluationResult['openRiskResult'];
  visionResult?: ReviewPipelineEvaluationResult['visionResult'];
  caseRetrieval?: CaseRetrievalResult;
  caseFindings: CaseFinding[];
  timings: Pick<ReviewPipelineTimings, 'ruleMs' | 'playbookMs' | 'openRiskMs' | 'visionMs' | 'totalMs'>;
};

const REWRITE_SUGGEST_CONCURRENCY = 3;

function measureStage<T>(operation: () => T | Promise<T>): Promise<{ result: T; durationMs: number }> {
  const started = performance.now();
  return Promise.resolve(operation()).then((result) => ({
    result,
    durationMs: Math.round(performance.now() - started),
  }));
}

export class ReviewPipelineService {
  constructor(private readonly deps: ReviewPipelineServiceDeps) {}

  private async resolveCaseStage(
    context: ReviewContext,
    ruleResult: ReviewPipelineEvaluationResult['ruleResult'],
  ): Promise<CaseStageResult> {
    if (!this.deps.caseRetrievalService || !isCaseFirstEnabled()) {
      return { caseFindings: [] };
    }

    const caseRetrieval = await this.deps.caseRetrievalService.retrieve(context, {
      ruleRefIds: ruleResult.findings.map((finding) => finding.refId),
    });
    const caseReviewContext = this.deps.caseContextAssembler
      ? await this.deps.caseContextAssembler.assemble(caseRetrieval, ruleResult)
      : undefined;
    const caseFindings = this.deps.caseFindingGeneratorService
      ? this.deps.caseFindingGeneratorService.generate(
          caseRetrieval,
          ruleResult,
          caseReviewContext,
        )
      : [];

    return { caseRetrieval, caseReviewContext, caseFindings };
  }

  private fuseDecision(
    openRiskStage: Pick<
      EvaluationStageResult,
      'ruleResult' | 'playbookResult' | 'openRiskResult' | 'visionResult' | 'caseFindings'
    >,
    reviewId: string,
    countryId: string,
  ) {
    const decisionCaseFindings = isCaseFindingsInDecisionEnabled()
      ? openRiskStage.caseFindings
      : [];
    const visionFindings = openRiskStage.visionResult?.findings ?? [];
    const consistencyFindings = openRiskStage.visionResult?.consistencyFindings ?? [];

    return this.deps.decisionEngineService.fuseFromFindings({
      reviewId,
      countryId,
      hasBlocker: computeCombinedHasBlocker({
        ruleHasBlocker: openRiskStage.ruleResult.hasBlocker,
        visionFindings,
      }),
      ruleFindings: openRiskStage.ruleResult.findings,
      playbookFindings: openRiskStage.playbookResult.findings,
      llmFindings: openRiskStage.openRiskResult.findings,
      visionFindings,
      consistencyFindings,
      caseFindings: decisionCaseFindings,
    });
  }

  private async resolveVisionStage(context: ReviewContext) {
    if (!this.deps.visionComplianceService) {
      return undefined;
    }
    return this.deps.visionComplianceService.discover(context);
  }

  private collectWarnFindingsForRewrite(stage: EvaluationStageResult): WarnFinding[] {
    const findings: WarnFinding[] = [];

    for (const finding of stage.ruleResult.findings) {
      if (finding.decision === 'WARN' || finding.decision === 'REVIEW') {
        findings.push(finding);
      }
    }
    for (const finding of stage.playbookResult.findings) {
      if (finding.decision === 'WARN' || finding.decision === 'REVIEW') {
        findings.push(finding);
      }
    }
    for (const finding of stage.openRiskResult.findings) {
      if (finding.decision === 'WARN' || finding.decision === 'REVIEW') {
        findings.push(finding);
      }
    }
    for (const finding of stage.visionResult?.findings ?? []) {
      if (finding.decision === 'WARN' || finding.decision === 'REVIEW') {
        findings.push(finding);
      }
    }
    // Consistency findings are decision-fused but not rewrite targets yet.
    for (const finding of stage.caseFindings) {
      if (finding.decision === 'WARN') {
        findings.push(finding);
      }
    }

    return findings;
  }

  private async resolveContextualRewrites(
    context: ReviewContext,
    decision: ReviewPipelineEvaluationResult['decision'],
    stage: EvaluationStageResult,
  ): Promise<ContextualRewriteBatchResult | undefined> {
    const service = this.deps.contextualRewriteService;
    // REVIEW still routes to a human sign-off, but a draft rewrite suggestion is useful reference
    // material for that manual check — same as WARN. (Registration/status-only REVIEW findings,
    // e.g. CPSR/COE, may get suggestions that don't fit; revisit with a risk_type filter if reviewers
    // report the suggestions are unhelpful there.)
    if (!service || (decision.finalDecision !== 'WARN' && decision.finalDecision !== 'REVIEW')) {
      return undefined;
    }

    const started = performance.now();
    const mode = service.resolveMode();
    if (mode === 'off') {
      return {
        mode,
        results: [],
        rewriteMs: Math.round(performance.now() - started),
      };
    }

    const warnFindings = this.collectWarnFindingsForRewrite(stage);
    const results = await mapWithConcurrency(
      warnFindings,
      REWRITE_SUGGEST_CONCURRENCY,
      (finding) =>
        service.suggest({
          reviewId: context.reviewId,
          finding,
          adText: context.normalizedContent.text,
          context,
        }),
    );

    return {
      mode,
      results,
      rewriteMs: Math.round(performance.now() - started),
    };
  }

  async runThroughOpenRisk(context: ReviewContext): Promise<EvaluationStageResult> {
    const started = performance.now();
    const { result: ruleResult, durationMs: ruleMs } = await measureStage(() =>
      this.deps.ruleEngineService.evaluate(context),
    );
    const { caseRetrieval, caseReviewContext, caseFindings } = await this.resolveCaseStage(
      context,
      ruleResult,
    );
    const playbookOptions = {
      ...(isCaseInPlaybookEnabled() && caseReviewContext ? { caseReviewContext } : {}),
      priorRuleFindings: ruleResult.findings,
    };
    const { result: playbookResult, durationMs: playbookMs } = await measureStage(() =>
      this.deps.playbookEngineService.evaluate(context, playbookOptions),
    );

    const priorCaseReviewContext =
      isCaseGroundLlmEnabled() && caseReviewContext ? caseReviewContext : undefined;
    const prior = buildPriorFindingsSummary(ruleResult, playbookResult, {
      caseReviewContext: priorCaseReviewContext,
      caseFindings,
    });
    const { result: openRiskResult, durationMs: openRiskMs } = await measureStage(() =>
      this.deps.openRiskDiscoveryService.discover(context, prior),
    );
    const { result: visionResult, durationMs: visionMs } = await measureStage(() =>
      this.resolveVisionStage(context),
    );

    // Force REVIEW when images are present but text/pixels are not auditable.
    const gatedVisionResult = applyImageReadabilityGate(context, visionResult);

    // Re-run rules against Vision-extracted visible text so image-only / OCR-miss
    // claims (non-stick, cook-time, capacity) still produce RULE findings.
    let mergedRuleResult = ruleResult;
    let ruleMsTotal = ruleMs;
    const visionTextContext = withVisionTextContext(context, gatedVisionResult);
    if (visionTextContext.normalizedContent.visionText) {
      const { result: visionRuleResult, durationMs: visionRuleMs } = await measureStage(() =>
        this.deps.ruleEngineService.evaluate(visionTextContext),
      );
      mergedRuleResult = mergeRuleEvaluationResults(ruleResult, visionRuleResult);
      ruleMsTotal += visionRuleMs;
    }

    return {
      ruleResult: mergedRuleResult,
      playbookResult,
      openRiskResult,
      ...(gatedVisionResult ? { visionResult: gatedVisionResult } : {}),
      caseRetrieval,
      caseFindings,
      timings: {
        ruleMs: ruleMsTotal,
        playbookMs,
        openRiskMs,
        visionMs,
        totalMs: Math.round(performance.now() - started),
      },
    };
  }

  async runThroughDecision(context: ReviewContext): Promise<ReviewPipelineEvaluationResult> {
    const started = performance.now();
    const openRiskStage = await this.runThroughOpenRisk(context);
    const { result: decision, durationMs: decisionMs } = await measureStage(() =>
      this.fuseDecision(openRiskStage, context.reviewId, context.dimensions.countryId),
    );

    return {
      ruleResult: openRiskStage.ruleResult,
      playbookResult: openRiskStage.playbookResult,
      openRiskResult: openRiskStage.openRiskResult,
      ...(openRiskStage.visionResult ? { visionResult: openRiskStage.visionResult } : {}),
      decision,
      timings: {
        ...openRiskStage.timings,
        decisionMs,
        reportMs: 0,
        totalMs: Math.round(performance.now() - started),
      },
    };
  }

  async runThroughReport(context: ReviewContext): Promise<ReviewPipelineReportResult> {
    const started = performance.now();
    const openRiskStage = await this.runThroughOpenRisk(context);
    const { result: decision, durationMs: decisionMs } = await measureStage(() =>
      this.fuseDecision(openRiskStage, context.reviewId, context.dimensions.countryId),
    );
    const casePrecedents: CasePrecedent[] = openRiskStage.caseRetrieval?.precedents ?? [];
    const { result: contextualRewrites, durationMs: rewriteMs } = await measureStage(() =>
      this.resolveContextualRewrites(context, decision, openRiskStage),
    );
    const { result: report, durationMs: reportMs } = await measureStage(() =>
      this.deps.reviewReportService.render({
        context,
        decision,
        ruleFindings: openRiskStage.ruleResult.findings,
        playbookFindings: openRiskStage.playbookResult.findings,
        openRiskResult: openRiskStage.openRiskResult,
        visionFindings: openRiskStage.visionResult?.findings ?? [],
        consistencyFindings: openRiskStage.visionResult?.consistencyFindings ?? [],
        visionMode: resolveVisionLlmMode(),
        sliceThumbnails: openRiskStage.visionResult?.sliceThumbnails,
        caseFindings: openRiskStage.caseFindings,
        casePrecedents,
        contextualRewrites,
      }),
    );

    return {
      ruleResult: openRiskStage.ruleResult,
      playbookResult: openRiskStage.playbookResult,
      openRiskResult: openRiskStage.openRiskResult,
      ...(openRiskStage.visionResult ? { visionResult: openRiskStage.visionResult } : {}),
      decision,
      report,
      ...(contextualRewrites ? { contextualRewrites } : {}),
      timings: {
        ...openRiskStage.timings,
        decisionMs,
        reportMs,
        rewriteMs,
        totalMs: Math.round(performance.now() - started),
      },
    };
  }
}
