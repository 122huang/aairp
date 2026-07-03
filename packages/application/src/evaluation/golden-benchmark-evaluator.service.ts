import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
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
  resolveGoldenBenchmarkCasesPath,
  resolveGoldenBenchmarkOutputDir,
} from './golden-benchmark-paths.js';

export type GoldenCaseFixture = {
  content?: {
    text?: string;
    ocr_text?: string;
    images?: string[];
  };
  context?: {
    product_sku?: string;
    ai_rendered_image?: boolean;
    certification_image_unreadable?: boolean;
    ai_image_quality_issue?: boolean;
  };
};

export type GoldenBenchmarkCase = {
  id: string;
  text: string;
  expected: 'PASS' | 'WARN' | 'REJECT' | 'REVIEW';
  risk: string;
  issue: string;
  modality: string;
  fixture?: GoldenCaseFixture;
};

export type GoldenCaseResult = GoldenBenchmarkCase & {
  actual: string | null;
  findings: string[];
  status: 'PASS' | 'MISS' | 'OVER' | 'UNDER' | 'MISMATCH' | 'SKIP_MODALITY';
  note: string;
};

export type GoldenBenchmarkSummary = {
  benchmark: string;
  mode: string;
  rule_pack_version: string;
  total: number;
  runnable: number;
  text_runnable: number;
  image_fixture_runnable: number;
  skipped_multimodal: number;
  pass: number;
  miss: number;
  over: number;
  under: number;
  pass_rate: string;
};

export type GoldenBenchmarkEvalResult = {
  summary: GoldenBenchmarkSummary;
  results: GoldenCaseResult[];
  failed_case_ids: string[];
};

export type GoldenBenchmarkEvalOptions = {
  casesPath?: string;
  outputPath?: string;
  writeReport?: boolean;
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

function mapGoldenToEngine(expected: GoldenBenchmarkCase['expected']): string[] {
  if (expected === 'REJECT') {
    return ['REJECT'];
  }
  return ['WARN', 'REJECT'];
}

function isRunnableCase(testCase: GoldenBenchmarkCase): boolean {
  return testCase.modality === 'text' || Boolean(testCase.fixture);
}

function buildContext(testCase: GoldenBenchmarkCase, rulePackVersion: string): ReviewContext {
  const fixture = testCase.fixture;
  const text = fixture?.content?.text ?? testCase.text;
  const imageUrls = fixture?.content?.images ?? [];
  const ocrText = fixture?.content?.ocr_text;

  return {
    reviewId: 'rev_golden',
    advertisementId: 'ad_golden',
    contentHash: 'hash_golden',
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: 'SG',
      platformId: 'META',
      categoryId: 'electronics',
    },
    normalizedContent: {
      text,
      imageUrls,
      ...(ocrText ? { ocrText } : {}),
    },
    resolvedKnowledgeVersions: {
      ...DEMO_KNOWLEDGE_VERSIONS,
      rulePackVersion,
    },
    advertisementContext: {
      ...(fixture?.context?.product_sku
        ? { productSku: fixture.context.product_sku }
        : {}),
      ...(fixture?.context?.ai_rendered_image === true
        ? { aiRenderedImage: true }
        : {}),
      ...(fixture?.context?.certification_image_unreadable === true
        ? { certificationImageUnreadable: true }
        : {}),
      ...(fixture?.context?.ai_image_quality_issue === true
        ? { aiImageQualityIssue: true }
        : {}),
    },
    tags: [],
    builtAt: new Date().toISOString(),
  };
}

function classifyCase(
  testCase: GoldenBenchmarkCase,
  actual: string | null,
): Pick<GoldenCaseResult, 'status' | 'note'> {
  if (!isRunnableCase(testCase)) {
    return { status: 'SKIP_MODALITY', note: `需${testCase.modality}能力` };
  }

  const allowed = mapGoldenToEngine(testCase.expected);
  if (actual && allowed.includes(actual)) {
    return { status: 'PASS', note: '' };
  }
  if (actual === 'PASS') {
    return { status: 'MISS', note: '未命中（GAP）' };
  }
  if (actual === 'REJECT' && testCase.expected === 'REVIEW') {
    return { status: 'OVER', note: '偏严' };
  }
  if (actual === 'WARN' && testCase.expected === 'REJECT') {
    return { status: 'UNDER', note: '偏松' };
  }
  return { status: 'MISMATCH', note: `expected ${testCase.expected}, got ${actual}` };
}

export async function runGoldenBenchmarkEval(
  options: GoldenBenchmarkEvalOptions = {},
): Promise<GoldenBenchmarkEvalResult> {
  const casesPath = resolveGoldenBenchmarkCasesPath(options.casesPath);
  const rulePack = loadDemoRulePackSync();
  const cases = JSON.parse(readFileSync(casesPath, 'utf8')) as GoldenBenchmarkCase[];
  const pipeline = createPipeline();

  const results: GoldenCaseResult[] = [];
  let pass = 0;
  let miss = 0;
  let over = 0;
  let under = 0;
  let skip = 0;

  for (const testCase of cases) {
    if (!isRunnableCase(testCase)) {
      skip++;
      results.push({
        ...testCase,
        actual: null,
        findings: [],
        ...classifyCase(testCase, null),
      });
      continue;
    }

    const out = await pipeline.runThroughReport(buildContext(testCase, rulePack.pack_version));
    const actual = out.report.summary.finalDecision;
    const findings = out.report.summary.findings.map((f) => f.refId ?? f.summary);
    const verdict = classifyCase(testCase, actual);
    results.push({ ...testCase, actual, findings, ...verdict });

    if (verdict.status === 'PASS') {
      pass++;
    } else if (verdict.status === 'MISS') {
      miss++;
    } else if (verdict.status === 'OVER') {
      over++;
    } else if (verdict.status === 'UNDER') {
      under++;
    }
  }

  const textRunnable = cases.filter((c) => c.modality === 'text').length;
  const imageFixtureRunnable = cases.filter(
    (c) => c.modality === 'image' && Boolean(c.fixture),
  ).length;
  const fixtureRunnable = cases.filter(
    (c) => c.modality !== 'text' && Boolean(c.fixture),
  ).length;
  const runnable = textRunnable + fixtureRunnable;

  const summary: GoldenBenchmarkSummary = {
    benchmark: 'Ad Compliance Hub Golden Benchmark v1.0',
    mode: 'offline-pipeline',
    rule_pack_version: rulePack.pack_version,
    total: cases.length,
    runnable,
    text_runnable: textRunnable,
    image_fixture_runnable: imageFixtureRunnable,
    skipped_multimodal: skip,
    pass,
    miss,
    over,
    under,
    pass_rate: runnable ? `${((pass / runnable) * 100).toFixed(1)}%` : 'n/a',
  };

  const failed_case_ids = results
    .filter(
      (r) =>
        r.status === 'MISS' ||
        r.status === 'OVER' ||
        r.status === 'UNDER' ||
        r.status === 'MISMATCH',
    )
    .map((r) => r.id);

  if (options.writeReport !== false && options.outputPath) {
    mkdirSync(dirname(options.outputPath), { recursive: true });
    writeFileSync(
      options.outputPath,
      JSON.stringify({ summary, results }, null, 2),
      'utf8',
    );
  }

  return { summary, results, failed_case_ids };
}

export function defaultGoldenBenchmarkOutputPath(): string {
  const dir = resolveGoldenBenchmarkOutputDir();
  return `${dir}/golden-benchmark-v1-offline.json`;
}
