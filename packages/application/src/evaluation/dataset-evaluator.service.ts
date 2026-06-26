import type { IAdvertisementRepository, NormalizedAdvertisement } from '@aairp/domain';
import { AdvertisementUploadService } from '../advertisement/advertisement-upload.service.js';
import { ContextBuilderService } from '../review/context-builder.service.js';
import { DecisionEngineService } from '../review/decision-engine.service.js';
import { OpenRiskDiscoveryService } from '../review/open-risk-discovery.service.js';
import { PlaybookEngineService } from '../review/playbook-engine.service.js';
import { ReviewPipelineService } from '../review/review-pipeline.service.js';
import { ReviewReportService } from '../review/review-report.service.js';
import { RuleEngineService } from '../review/rule-engine.service.js';
import type { BenchmarkEvalResult } from './benchmark-types.js';
import { buildEvalCaseActual, compareEvalCase } from './eval-case.js';
import { computeEvalMetrics } from './eval-metrics.js';
import { defaultReportsOutputDir, writeEvalReports } from './eval-report.js';
import type { DatasetCase } from './load-dataset.js';
import { loadAllDatasetCases, loadAutoVerifiedDatasetCases } from './load-dataset.js';

export type RunDatasetEvalOptions = {
  autoOnly?: boolean;
  writeReports?: boolean;
  outputDir?: string;
};

function createInMemoryRepository(): IAdvertisementRepository {
  const store = new Map<string, NormalizedAdvertisement>();
  return {
    save: async (advertisement) => {
      store.set(advertisement.advertisementId, advertisement);
      return advertisement;
    },
    findById: async (advertisementId) => store.get(advertisementId) ?? null,
  };
}

function createUploadPipeline(): {
  uploadService: AdvertisementUploadService;
  contextBuilder: ContextBuilderService;
  pipeline: ReviewPipelineService;
} {
  const repository = createInMemoryRepository();
  return {
    uploadService: new AdvertisementUploadService(repository),
    contextBuilder: new ContextBuilderService(repository),
    pipeline: new ReviewPipelineService({
      ruleEngineService: new RuleEngineService(),
      playbookEngineService: new PlaybookEngineService(),
      openRiskDiscoveryService: new OpenRiskDiscoveryService(),
      decisionEngineService: new DecisionEngineService(),
      reviewReportService: new ReviewReportService(),
    }),
  };
}

function requireGroundTruth(datasetCase: DatasetCase) {
  if (!datasetCase.ground_truth) {
    throw new Error(`dataset case ${datasetCase.case_id} missing ground_truth`);
  }
  return datasetCase.ground_truth;
}

export async function runDatasetEval(
  options: RunDatasetEvalOptions = {},
): Promise<BenchmarkEvalResult> {
  const cases = options.autoOnly
    ? loadAutoVerifiedDatasetCases()
    : loadAllDatasetCases();
  const evaluatedAt = new Date().toISOString();
  const caseResults = [];

  for (const datasetCase of cases) {
    const groundTruth = requireGroundTruth(datasetCase);
    const { uploadService, contextBuilder, pipeline } = createUploadPipeline();
    const advertisement = await uploadService.upload(datasetCase.upload);
    const context = contextBuilder.buildFromAdvertisement(advertisement);
    const pipelineResult = await pipeline.runThroughReport(context);
    const actual = buildEvalCaseActual(pipelineResult);

    caseResults.push(
      compareEvalCase(
        datasetCase.case_id,
        datasetCase.notes ?? datasetCase.case_id,
        [
          datasetCase.country_id,
          datasetCase.category_id,
          datasetCase.intent,
          datasetCase.verification,
        ],
        groundTruth,
        actual,
      ),
    );
  }

  const metrics = computeEvalMetrics(caseResults);
  const evalResult: BenchmarkEvalResult = {
    benchmark_id: 'aairp-demo-dataset',
    schema_version: '1.0.0',
    evaluated_at: evaluatedAt,
    manifest_path: 'demo/dataset/index.json',
    case_results: caseResults,
    metrics,
    failed_case_ids: caseResults.filter((result) => !result.passed).map((result) => result.case_id),
  };

  if (options.writeReports !== false) {
    writeEvalReports(evalResult, options.outputDir ?? defaultReportsOutputDir());
  }

  return evalResult;
}
