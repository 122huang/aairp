import { DecisionEngineService } from '../review/decision-engine.service.js';
import { OpenRiskDiscoveryService } from '../review/open-risk-discovery.service.js';
import { PlaybookEngineService } from '../review/playbook-engine.service.js';
import { ReviewPipelineService } from '../review/review-pipeline.service.js';
import { ReviewReportService } from '../review/review-report.service.js';
import { RuleEngineService } from '../review/rule-engine.service.js';
import type { BenchmarkEvalResult } from './benchmark-types.js';
import { buildEvalCaseActual, compareEvalCase } from './eval-case.js';
import { computeEvalMetrics } from './eval-metrics.js';
import {
  defaultBenchmarkManifestPath,
  loadBenchmarkManifest,
  selectBenchmarkCases,
} from './load-benchmark.js';
import {
  defaultReportsOutputDir,
  writeEvalReports,
} from './eval-report.js';

export type RunBenchmarkOptions = {
  manifestPath?: string;
  outputDir?: string;
  regressionOnly?: boolean;
  caseIds?: string[];
  writeReports?: boolean;
};

function createDefaultPipeline(): ReviewPipelineService {
  return new ReviewPipelineService({
    ruleEngineService: new RuleEngineService(),
    playbookEngineService: new PlaybookEngineService(),
    openRiskDiscoveryService: new OpenRiskDiscoveryService(),
    decisionEngineService: new DecisionEngineService(),
    reviewReportService: new ReviewReportService(),
  });
}

export async function runBenchmarkEval(
  options: RunBenchmarkOptions = {},
): Promise<BenchmarkEvalResult> {
  const manifestPath = options.manifestPath ?? defaultBenchmarkManifestPath();
  const manifest = loadBenchmarkManifest(manifestPath);
  const cases = selectBenchmarkCases(manifest, {
    regressionOnly: options.regressionOnly,
    caseIds: options.caseIds,
  });
  const pipeline = createDefaultPipeline();
  const evaluatedAt = new Date().toISOString();

  const caseResults = [];
  for (const benchmarkCase of cases) {
    const pipelineResult = await pipeline.runThroughReport(benchmarkCase.context);
    const actual = buildEvalCaseActual(pipelineResult);
    caseResults.push(
      compareEvalCase(
        benchmarkCase.case_id,
        benchmarkCase.description,
        benchmarkCase.tags,
        benchmarkCase.ground_truth,
        actual,
      ),
    );
  }

  const metrics = computeEvalMetrics(caseResults);
  const failed_case_ids = caseResults
    .filter((result) => !result.passed)
    .map((result) => result.case_id);

  const evalResult: BenchmarkEvalResult = {
    benchmark_id: manifest.benchmark_id,
    schema_version: manifest.schema_version,
    evaluated_at: evaluatedAt,
    manifest_path: manifestPath,
    case_results: caseResults,
    metrics,
    failed_case_ids,
  };

  if (options.writeReports !== false) {
    writeEvalReports(evalResult, options.outputDir ?? defaultReportsOutputDir());
  }

  return evalResult;
}
