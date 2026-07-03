import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReviewContext, RuleFinding } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import { ContextualRewriteService } from '../review/contextual-rewrite.service.js';
import { RuleEngineService } from '../review/rule-engine.service.js';

export type RewriteQualityCaseFixture = {
  country_id: string;
  platform_id: string;
  category_id: string;
  rule_ref_id: string;
  ai_rendered_image?: boolean;
  product_sku?: string;
  ocr_text?: string;
};

export type RewriteQualityStubExpected = {
  suggested_text_contains: string[];
  rationale_contains: string[];
  confidence_min: number;
};

export type RewriteQualitySelfCheck = {
  must_not_trigger_rule_ids: string[];
};

export type RewriteQualityCase = {
  case_id: string;
  risk_type: string;
  locale: 'zh' | 'en';
  ad_text: string;
  original_span: string;
  rewrite_strategy: string;
  fixture: RewriteQualityCaseFixture;
  stub_expected: RewriteQualityStubExpected;
  self_check: RewriteQualitySelfCheck;
};

export type RewriteQualityManifest = {
  manifest_version: string;
  pack_version: string;
  description: string;
  scoring: {
    pass: string;
    fail: string;
    warn: string;
  };
  cases: RewriteQualityCase[];
};

export type RewriteQualityCaseOutcome = {
  case_id: string;
  risk_type: string;
  locale: 'zh' | 'en';
  status: 'pass' | 'fail' | 'warn';
  failures: string[];
  warnings: string[];
};

export type RewriteQualityBenchmarkReport = {
  pack_version: string;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  outcomes: RewriteQualityCaseOutcome[];
};

const defaultManifestPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../benchmark/rewrite-quality-v1.json',
);

export function resolveRewriteQualityManifestPath(customPath?: string): string {
  return customPath ?? defaultManifestPath;
}

export function loadRewriteQualityManifest(customPath?: string): RewriteQualityManifest {
  return JSON.parse(
    readFileSync(resolveRewriteQualityManifestPath(customPath), 'utf8'),
  ) as RewriteQualityManifest;
}

export function toRewriteBenchmarkReviewContext(testCase: RewriteQualityCase): ReviewContext {
  return {
    reviewId: `rev_${testCase.case_id}`,
    advertisementId: `ad_${testCase.case_id}`,
    contentHash: `hash_${testCase.case_id}`,
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: testCase.fixture.country_id,
      platformId: testCase.fixture.platform_id,
      categoryId: testCase.fixture.category_id,
    },
    normalizedContent: {
      text: testCase.ad_text,
      imageUrls: testCase.fixture.ai_rendered_image
        ? ['https://example.com/product.jpg']
        : [],
      ...(testCase.fixture.ocr_text ? { ocrText: testCase.fixture.ocr_text } : {}),
    },
    resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
    advertisementContext: {
      ...(testCase.fixture.ai_rendered_image
        ? { aiRenderedImage: testCase.fixture.ai_rendered_image }
        : {}),
      ...(testCase.fixture.product_sku ? { productSku: testCase.fixture.product_sku } : {}),
    },
    tags: ['rewrite-quality-benchmark'],
    builtAt: '2026-06-29T00:00:00.000Z',
  };
}

function createBenchmarkFinding(testCase: RewriteQualityCase): RuleFinding {
  const start = testCase.ad_text.indexOf(testCase.original_span);
  const end = start >= 0 ? start + testCase.original_span.length : testCase.original_span.length;

  return {
    module: 'RULE',
    findingId: `rf_${testCase.case_id}`,
    severity: 'MEDIUM',
    decision: 'WARN',
    refType: 'RULE',
    refId: testCase.fixture.rule_ref_id,
    refVersionId: `${testCase.fixture.rule_ref_id}-benchmark`,
    summary: `${testCase.risk_type} benchmark case`,
    confidence: 1,
    evaluationDetail: {
      matchedSpans: [
        {
          field: 'text',
          start: Math.max(start, 0),
          end,
          text: testCase.original_span,
        },
      ],
    },
  };
}

function containsPattern(haystack: string, pattern: string, locale: 'zh' | 'en'): boolean {
  const probe = locale === 'zh' ? haystack : haystack.toLowerCase();
  const needle = locale === 'zh' ? pattern : pattern.toLowerCase();
  return probe.includes(needle);
}

function evaluateSuggestedTextContains(
  suggestedTexts: string[],
  patterns: string[],
  locale: 'zh' | 'en',
): string[] {
  const failures: string[] = [];
  for (const pattern of patterns) {
    const matched = suggestedTexts.some((text) => containsPattern(text, pattern, locale));
    if (!matched) {
      failures.push(`missing suggested_text_contains pattern: ${pattern}`);
    }
  }
  return failures;
}

function evaluateRationaleContains(rationale: string, patterns: string[], locale: 'zh' | 'en'): string[] {
  const failures: string[] = [];
  for (const pattern of patterns) {
    if (!containsPattern(rationale, pattern, locale)) {
      failures.push(`missing rationale_contains pattern: ${pattern}`);
    }
  }
  return failures;
}

function evaluateSelfCheck(
  testCase: RewriteQualityCase,
  suggestedTexts: string[],
  ruleEngine: RuleEngineService,
): string[] {
  const failures: string[] = [];
  const watchedRuleIds = new Set(testCase.self_check.must_not_trigger_rule_ids);
  const baseContext = toRewriteBenchmarkReviewContext(testCase);

  for (const [index, text] of suggestedTexts.entries()) {
    const result = ruleEngine.evaluate({
      ...baseContext,
      normalizedContent: {
        ...baseContext.normalizedContent,
        text,
      },
    });

    for (const finding of result.findings) {
      if (watchedRuleIds.has(finding.refId)) {
        failures.push(
          `suggested_text[${index}] triggered ${finding.refId}: ${finding.evaluationDetail?.matchedSpans?.[0]?.text ?? finding.summary}`,
        );
      }
    }
  }

  return failures;
}

export async function evaluateRewriteQualityCase(
  testCase: RewriteQualityCase,
  options?: {
    rewriteService?: ContextualRewriteService;
    ruleEngine?: RuleEngineService;
  },
): Promise<RewriteQualityCaseOutcome> {
  const rewriteService =
    options?.rewriteService ??
    new ContextualRewriteService({
      mode: 'stub',
      createSuggestionId: () => `bench-${testCase.case_id}`,
    });
  const ruleEngine = options?.ruleEngine ?? new RuleEngineService();

  const failures: string[] = [];
  const warnings: string[] = [];

  const result = await rewriteService.suggest({
    reviewId: `rev_${testCase.case_id}`,
    adText: testCase.ad_text,
    locale: testCase.locale,
    context: toRewriteBenchmarkReviewContext(testCase),
    finding: createBenchmarkFinding(testCase),
  });

  if (result.skipped || !result.suggestion) {
    failures.push(`rewrite skipped: ${result.skipReason ?? 'NO_SUGGESTION'}`);
    return {
      case_id: testCase.case_id,
      risk_type: testCase.risk_type,
      locale: testCase.locale,
      status: 'fail',
      failures,
      warnings,
    };
  }

  const { suggestion } = result;

  failures.push(
    ...evaluateSuggestedTextContains(
      suggestion.suggestedText,
      testCase.stub_expected.suggested_text_contains,
      testCase.locale,
    ),
  );
  failures.push(
    ...evaluateRationaleContains(
      suggestion.rationale,
      testCase.stub_expected.rationale_contains,
      testCase.locale,
    ),
  );
  failures.push(...evaluateSelfCheck(testCase, suggestion.suggestedText, ruleEngine));

  if (suggestion.confidence < testCase.stub_expected.confidence_min) {
    warnings.push(
      `confidence ${suggestion.confidence} below minimum ${testCase.stub_expected.confidence_min}`,
    );
  }

  const status: RewriteQualityCaseOutcome['status'] =
    failures.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';

  return {
    case_id: testCase.case_id,
    risk_type: testCase.risk_type,
    locale: testCase.locale,
    status,
    failures,
    warnings,
  };
}

export async function runRewriteQualityBenchmark(
  manifest: RewriteQualityManifest = loadRewriteQualityManifest(),
): Promise<RewriteQualityBenchmarkReport> {
  const outcomes: RewriteQualityCaseOutcome[] = [];

  for (const testCase of manifest.cases) {
    outcomes.push(await evaluateRewriteQualityCase(testCase));
  }

  const passed = outcomes.filter((outcome) => outcome.status === 'pass').length;
  const warned = outcomes.filter((outcome) => outcome.status === 'warn').length;
  const failed = outcomes.filter((outcome) => outcome.status === 'fail').length;

  return {
    pack_version: manifest.pack_version,
    total: manifest.cases.length,
    passed,
    failed,
    warned,
    outcomes,
  };
}

export function formatRewriteQualityBenchmarkSummary(report: RewriteQualityBenchmarkReport): string {
  const lines = [
    `rewrite-quality-v1 summary: ${report.passed}/${report.total} passed, ${report.warned} warned, ${report.failed} failed`,
  ];

  for (const outcome of report.outcomes) {
    if (outcome.status === 'pass') {
      lines.push(`PASS ${outcome.case_id} (${outcome.risk_type}/${outcome.locale})`);
      continue;
    }
    const label = outcome.status === 'fail' ? 'FAIL' : 'WARN';
    lines.push(
      `${label} ${outcome.case_id} (${outcome.risk_type}/${outcome.locale}) — ${[...outcome.failures, ...outcome.warnings].join('; ')}`,
    );
  }

  return lines.join('\n');
}
