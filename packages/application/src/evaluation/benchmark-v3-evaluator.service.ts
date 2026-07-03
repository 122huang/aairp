import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import { ReviewPipelineService } from '../review/review-pipeline.service.js';
import { RuleEngineService } from '../review/rule-engine.service.js';
import { PlaybookEngineService } from '../review/playbook-engine.service.js';
import { OpenRiskDiscoveryService } from '../review/open-risk-discovery.service.js';
import { DecisionEngineService } from '../review/decision-engine.service.js';
import { ReviewReportService } from '../review/review-report.service.js';
import { loadDemoRulePackSync } from '../knowledge/load-demo-rule-pack.js';
import {
  loadKnowledgePackManifest,
  packVersion,
  packFingerprint,
  corpusFingerprints,
} from '../knowledge/knowledge-pack-manifest.js';
import { matchPlaybookRewriteGuidance } from '../knowledge/rewrite-templates.js';
import { deriveExpectedAction } from '../knowledge/skill-modules.js';
import {
  loadBenchmarkV3,
  selectBenchmarkV3Cases,
  type BenchmarkV3Case,
} from './load-benchmark-v3.js';
import {
  aggregateV3Metrics,
  scoreV3Case,
  type V3EvalCaseResult,
  type V3EvalMetrics,
} from './eval-v3-metrics.js';

export type BenchmarkV3EvalResult = {
  benchmark_id: string;
  schema_version: string;
  evaluated_at: string;
  knowledge_pack_version: string | null;
  knowledge_pack_fingerprint: string | null;
  corpus_fingerprints?: Record<string, string> | null;
  manifest_path: string;
  case_results: V3EvalCaseResult[];
  metrics: V3EvalMetrics;
  failed_case_ids: string[];
};

export type RunBenchmarkV3Options = {
  manifestPath?: string;
  outputDir?: string;
  tier?: 'regression' | 'extended' | 'candidate' | 'pilot';
  caseIds?: string[];
  writeReports?: boolean;
};

function createPipeline(): ReviewPipelineService {
  const rulePack = loadDemoRulePackSync();
  return new ReviewPipelineService({
    ruleEngineService: new RuleEngineService({ rulePack }),
    playbookEngineService: new PlaybookEngineService(),
    openRiskDiscoveryService: new OpenRiskDiscoveryService(),
    decisionEngineService: new DecisionEngineService(),
    reviewReportService: new ReviewReportService(),
  });
}

function isRunnableCase(testCase: BenchmarkV3Case): boolean {
  return testCase.modality === 'text' || Boolean(testCase.fixture);
}

function resolveReviewDimensions(testCase: BenchmarkV3Case): {
  countryId: string;
  categoryId: string;
} {
  const fixture = testCase.fixture as {
    dimensions?: { countryId?: string; categoryId?: string };
  } | undefined;
  if (fixture?.dimensions?.categoryId) {
    return {
      countryId: fixture.dimensions.countryId ?? testCase.country_id ?? 'SG',
      categoryId: fixture.dimensions.categoryId,
    };
  }
  return {
    countryId: testCase.country_id ?? 'SG',
    categoryId: testCase.category_id ?? 'electronics',
  };
}

function buildContext(testCase: BenchmarkV3Case, rulePackVersion: string): ReviewContext {
  const fixture = testCase.fixture as {
    content?: { text?: string; images?: string[]; ocr_text?: string };
    context?: { product_sku?: string; ai_rendered_image?: boolean };
    dimensions?: { countryId?: string; categoryId?: string };
  };
  const text = fixture?.content?.text ?? testCase.text;
  const imageUrls = fixture?.content?.images ?? [];
  const dims = resolveReviewDimensions(testCase);

  return {
    reviewId: `rev_v3_${testCase.case_id}`,
    advertisementId: `ad_v3_${testCase.case_id}`,
    contentHash: `hash_v3_${testCase.case_id}`,
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: dims.countryId,
      platformId: 'META',
      categoryId: dims.categoryId,
    },
    normalizedContent: {
      text,
      imageUrls,
      ...(fixture?.content?.ocr_text ? { ocrText: fixture.content.ocr_text } : {}),
    },
    resolvedKnowledgeVersions: {
      ...DEMO_KNOWLEDGE_VERSIONS,
      rulePackVersion,
    },
    advertisementContext: {
      ...(fixture?.context?.product_sku ? { productSku: fixture.context.product_sku } : {}),
      ...(fixture?.context?.ai_rendered_image ? { aiRenderedImage: true } : {}),
    },
    tags: [],
    builtAt: new Date().toISOString(),
  };
}

function deriveActionFromDecision(decision: string): string {
  if (decision === 'REJECT') return 'REJECT';
  if (decision === 'PASS') return 'PASS';
  if (decision === 'WARN') return 'REWRITE';
  return deriveExpectedAction('REVIEW') === 'ESCALATE' ? 'ESCALATE' : 'REVIEW';
}

function formatV3Markdown(result: BenchmarkV3EvalResult): string {
  const lines = [
    '# Benchmark V3 Evaluation Report',
    '',
    `**Knowledge Pack:** ${result.knowledge_pack_version ?? '(not generated)'}`,
    `**Fingerprint:** ${result.knowledge_pack_fingerprint ?? '(not generated)'}`,
  ];
  if (result.corpus_fingerprints) {
    lines.push('', '**Corpus fingerprints:**');
    for (const [corpusType, fingerprint] of Object.entries(result.corpus_fingerprints).sort()) {
      lines.push(`- ${corpusType}: \`${fingerprint}\``);
    }
  }
  lines.push(
    `**Benchmark:** ${result.benchmark_id} (schema ${result.schema_version})`,
    `**Evaluated at:** ${result.evaluated_at}`,
    '',
    '## Overall Metrics',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Weighted Quality Score | ${(result.metrics.weighted_quality_score * 100).toFixed(1)}% |`,
    `| Decision Accuracy | ${(result.metrics.decision_accuracy * 100).toFixed(1)}% |`,
    `| Pattern Hit Rate | ${(result.metrics.pattern_hit_rate * 100).toFixed(1)}% |`,
    `| Action Accuracy | ${(result.metrics.action_accuracy * 100).toFixed(1)}% |`,
    `| Rewrite Score | ${(result.metrics.rewrite_score * 100).toFixed(1)}% |`,
    `| False Reject Rate | ${(result.metrics.false_reject_rate * 100).toFixed(1)}% |`,
    `| Blocker Miss Rate | ${(result.metrics.blocker_miss_rate * 100).toFixed(1)}% |`,
    '',
    '## Skill Module Summary',
    '',
    '| Module | Cases | Weighted Score | Decision Acc | Pattern Hit |',
    '|--------|------:|---------------:|-------------:|------------:|',
  );

  for (const mod of result.metrics.module_scores) {
    lines.push(
      `| ${mod.skill_module} | ${mod.case_count} | ${(mod.weighted_score * 100).toFixed(1)}% | ${(mod.decision_accuracy * 100).toFixed(1)}% | ${(mod.pattern_hit_rate * 100).toFixed(1)}% |`,
    );
  }

  if (result.failed_case_ids.length > 0) {
    lines.push('', '## Failed Cases', '', result.failed_case_ids.map((id) => `- ${id}`).join('\n'));
  }

  return lines.join('\n');
}

function resolveBenchmarkV3PathDefault(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../benchmark/benchmark-v3.json');
}

function defaultReportsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../reports');
}

export async function runBenchmarkV3Eval(
  options: RunBenchmarkV3Options = {},
): Promise<BenchmarkV3EvalResult> {
  const manifestPath = options.manifestPath ?? resolveBenchmarkV3PathDefault();
  const manifest = loadBenchmarkV3(manifestPath);
  const cases = selectBenchmarkV3Cases(manifest, {
    tier: options.tier,
    caseIds: options.caseIds,
  }).filter(isRunnableCase);

  const pipeline = createPipeline();
  const rulePack = loadDemoRulePackSync();
  const pack = loadKnowledgePackManifest();
  const evaluatedAt = new Date().toISOString();
  const caseResults: V3EvalCaseResult[] = [];

  for (const benchmarkCase of cases) {
    const context = buildContext(benchmarkCase, rulePack.pack_version);
    const adText =
      (benchmarkCase.fixture as { content?: { text?: string } } | undefined)?.content?.text ??
      benchmarkCase.text;
    const pipelineResult = await pipeline.runThroughReport(context);
    const decision = pipelineResult.decision.finalDecision;
    const playbookFindings = pipelineResult.playbookResult.findings;
    const patternIds = playbookFindings.map((f) => f.refId);
    const severities = [
      ...pipelineResult.ruleResult.findings.map((f) => f.severity),
      ...playbookFindings.map((f) => f.severity),
    ];
    const rewriteText = playbookFindings.map((f) => f.summary).join(' ');

    const rewriteMatch = matchPlaybookRewriteGuidance(
      adText,
      rewriteText,
      benchmarkCase.expected_rewrite,
    );

    caseResults.push(
      scoreV3Case(benchmarkCase, {
        final_decision: decision,
        pattern_ids: patternIds,
        severities,
        action: deriveActionFromDecision(decision),
        rewrite_text: rewriteText,
      }, rewriteMatch.score),
    );
  }

  const metrics = aggregateV3Metrics(caseResults);
  const failed_case_ids = caseResults.filter((r) => !r.passed).map((r) => r.case_id);

  const evalResult: BenchmarkV3EvalResult = {
    benchmark_id: manifest.benchmark_id,
    schema_version: manifest.schema_version,
    evaluated_at: evaluatedAt,
    knowledge_pack_version: pack ? packVersion(pack) : null,
    knowledge_pack_fingerprint: pack ? packFingerprint(pack) : null,
    corpus_fingerprints: pack ? corpusFingerprints(pack) : null,
    manifest_path: manifestPath,
    case_results: caseResults,
    metrics,
    failed_case_ids,
  };

  if (options.writeReports !== false) {
    const outputDir = options.outputDir ?? defaultReportsDir();
    mkdirSync(outputDir, { recursive: true });
    const stamp = evaluatedAt.replace(/[:.]/g, '-');
    writeFileSync(join(outputDir, `eval-v3-${stamp}.json`), `${JSON.stringify(evalResult, null, 2)}\n`);
    writeFileSync(join(outputDir, `eval-v3-${stamp}.md`), `${formatV3Markdown(evalResult)}\n`);
  }

  return evalResult;
}
