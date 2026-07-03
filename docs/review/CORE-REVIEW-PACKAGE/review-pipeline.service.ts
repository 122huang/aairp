import type {
  CaseFinding,
  CasePrecedent,
  CaseRetrievalResult,
  CaseReviewContext,
  ReviewContext,
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
import { DecisionEngineService } from './decision-engine.service.js';
import { OpenRiskDiscoveryService } from './open-risk-discovery.service.js';
import { PlaybookEngineService } from './playbook-engine.service.js';
import { ReviewReportService } from './review-report.service.js';
import { RuleEngineService } from './rule-engine.service.js';

export type ReviewPipelineServiceDeps = {
  ruleEngineService: RuleEngineService;
  playbookEngineService: PlaybookEngineService;
  openRiskDiscoveryService: OpenRiskDiscoveryService;
  decisionEngineService: DecisionEngineService;
  reviewReportService: ReviewReportService;
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
  caseRetrieval?: CaseRetrievalResult;
  caseFindings: CaseFinding[];
  timings: Pick<ReviewPipelineTimings, 'ruleMs' | 'playbookMs' | 'openRiskMs' | 'totalMs'>;
};

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
      'ruleResult' | 'playbookResult' | 'openRiskResult' | 'caseFindings'
    >,
    reviewId: string,
  ) {
    const decisionCaseFindings = isCaseFindingsInDecisionEnabled()
      ? openRiskStage.caseFindings
      : [];

    return this.deps.decisionEngineService.fuseFromFindings({
      reviewId,
      hasBlocker: openRiskStage.ruleResult.hasBlocker,
      ruleFindings: openRiskStage.ruleResult.findings,
      playbookFindings: openRiskStage.playbookResult.findings,
      llmFindings: openRiskStage.openRiskResult.findings,
      caseFindings: decisionCaseFindings,
    });
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
    const playbookOptions =
      isCaseInPlaybookEnabled() && caseReviewContext
        ? { caseReviewContext }
        : undefined;
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

    return {
      ruleResult,
      playbookResult,
      openRiskResult,
      caseRetrieval,
      caseFindings,
      timings: {
        ruleMs,
        playbookMs,
        openRiskMs,
        totalMs: Math.round(performance.now() - started),
      },
    };
  }

  async runThroughDecision(context: ReviewContext): Promise<ReviewPipelineEvaluationResult> {
    const started = performance.now();
    const openRiskStage = await this.runThroughOpenRisk(context);
    const { result: decision, durationMs: decisionMs } = await measureStage(() =>
      this.fuseDecision(openRiskStage, context.reviewId),
    );

    return {
      ruleResult: openRiskStage.ruleResult,
      playbookResult: openRiskStage.playbookResult,
      openRiskResult: openRiskStage.openRiskResult,
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
      this.fuseDecision(openRiskStage, context.reviewId),
    );
    const casePrecedents: CasePrecedent[] = openRiskStage.caseRetrieval?.precedents ?? [];
    const { result: report, durationMs: reportMs } = await measureStage(() =>
      this.deps.reviewReportService.render({
        context,
        decision,
        ruleFindings: openRiskStage.ruleResult.findings,
        playbookFindings: openRiskStage.playbookResult.findings,
        openRiskResult: openRiskStage.openRiskResult,
        caseFindings: openRiskStage.caseFindings,
        casePrecedents,
      }),
    );

    return {
      ruleResult: openRiskStage.ruleResult,
      playbookResult: openRiskStage.playbookResult,
      openRiskResult: openRiskStage.openRiskResult,
      decision,
      report,
      timings: {
        ...openRiskStage.timings,
        decisionMs,
        reportMs,
        totalMs: Math.round(performance.now() - started),
      },
    };
  }
}
