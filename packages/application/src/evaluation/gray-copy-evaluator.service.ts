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
  expandGrayCopyCases,
  loadGrayCopyFixture,
  resolveGrayCopyFixturePath,
  type GrayCopyEvalCase,
} from './load-gray-copy-fixture.js';
import {
  scoreGrayCopyCapability,
  type CoincidenceKind,
} from './gray-copy-scoring.js';

export type HitSourceFinding = {
  module: 'RULE' | 'PLAYBOOK' | 'LLM' | 'VISION';
  ref_id: string;
  severity: string;
  decision: string;
  summary: string;
  incidental: boolean;
};

export type GrayCopyCaseResult = {
  case_id: string;
  country_id: string;
  copy_id: number;
  gray_class: string;
  text: string;
  final_decision: string;
  open_risk_skipped: boolean;
  open_risk_ran: boolean;
  finding_counts: {
    rule: number;
    playbook: number;
    llm: number;
    vision: number;
  };
  hit_sources: HitSourceFinding[];
  llm_risk_types: string[];
  open_risk_capability_pass: boolean;
  /** Same-risk Rule cover (PASS) vs unrelated incidental mask (FAIL). null = neither. */
  coincidence_kind: CoincidenceKind | null;
  /** Legacy alias: true only when coincidence_kind === 'masked_by_unrelated'. */
  coincidence_only: boolean;
  same_risk_rule_refs: string[];
  failures: string[];
};

export type GrayCopyEvalResult = {
  fixture_id: string;
  evaluated_at: string;
  open_risk_mode: string;
  case_results: GrayCopyCaseResult[];
  metrics: {
    total_cases: number;
    open_risk_capability_passed: number;
    open_risk_capability_rate: number;
    coincidence_only_count: number;
    rule_covered_same_risk_count: number;
    masked_by_unrelated_count: number;
    must_fire_total: number;
    must_fire_caught: number;
    by_gray_class: Record<
      string,
      {
        total: number;
        capability_passed: number;
        coincidence_only: number;
        rule_covered_same_risk: number;
        masked_by_unrelated: number;
      }
    >;
    by_country: Record<
      string,
      {
        total: number;
        capability_passed: number;
        coincidence_only: number;
        rule_covered_same_risk: number;
        masked_by_unrelated: number;
      }
    >;
  };
  failed_case_ids: string[];
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

function buildContext(testCase: GrayCopyEvalCase): ReviewContext {
  const rulePack = loadDemoRulePackSync();
  return {
    reviewId: `rev_${testCase.case_id}`,
    advertisementId: `ad_${testCase.case_id}`,
    contentHash: `hash_${testCase.case_id}`,
    contentVersion: 1,
    dimensions: {
      tenantId: 'demo',
      countryId: testCase.country_id,
      platformId: 'META',
      categoryId: testCase.category_id,
    },
    normalizedContent: {
      text: testCase.text,
      imageUrls: [],
      language: 'zh',
    },
    resolvedKnowledgeVersions: {
      ...DEMO_KNOWLEDGE_VERSIONS,
      rulePackVersion: rulePack.pack_version,
    },
    advertisementContext: {},
    tags: ['gray-copy-eval', `gray-class:${testCase.gray_class}`],
    builtAt: new Date().toISOString(),
  };
}

function scoreCase(
  testCase: GrayCopyEvalCase,
  pipeline: Awaited<ReturnType<ReviewPipelineService['runThroughReport']>>,
): GrayCopyCaseResult {
  const incidental = new Set(testCase.incidental_rule_refs);
  const hit_sources: HitSourceFinding[] = [];

  for (const f of pipeline.ruleResult.findings) {
    hit_sources.push({
      module: 'RULE',
      ref_id: f.refId,
      severity: f.severity,
      decision: f.decision,
      summary: f.summary,
      incidental: incidental.has(f.refId),
    });
  }
  for (const f of pipeline.playbookResult.findings) {
    hit_sources.push({
      module: 'PLAYBOOK',
      ref_id: f.refId,
      severity: f.severity,
      decision: f.decision,
      summary: f.summary,
      incidental: false,
    });
  }
  for (const f of pipeline.openRiskResult.findings) {
    hit_sources.push({
      module: 'LLM',
      ref_id: f.refId,
      severity: f.severity,
      decision: f.decision,
      summary: f.summary,
      incidental: false,
    });
  }
  for (const f of pipeline.visionResult?.findings ?? []) {
    hit_sources.push({
      module: 'VISION',
      ref_id: f.refId,
      severity: f.severity,
      decision: f.decision,
      summary: f.summary,
      incidental: false,
    });
  }

  const scored = scoreGrayCopyCapability({
    open_risk_must_fire: testCase.open_risk_must_fire,
    acceptable_risk_types: testCase.acceptable_risk_types,
    hit_sources,
    final_decision: pipeline.decision.finalDecision,
  });

  const open_risk_skipped = pipeline.openRiskResult.skipped;
  const open_risk_ran = !open_risk_skipped;
  const nonIncidentalHits = hit_sources.filter((h) => !h.incidental);

  const failures: string[] = [];
  if (testCase.open_risk_must_fire && !open_risk_ran) {
    failures.push('open_risk_did_not_run');
  }
  if (testCase.open_risk_must_fire && !scored.llm_matched && !scored.rule_covered_same_risk) {
    failures.push(
      `open_risk_miss: expected one of [${testCase.acceptable_risk_types.join(', ')}], got [${scored.llm_risk_types.join(', ') || 'none'}]`,
    );
  }
  if (scored.coincidence_kind === 'rule_covered_same_risk') {
    failures.push(
      `rule_covered_same_risk: LLM empty OK — Rule/Playbook already covers acceptable risk via [${scored.same_risk_rule_refs.join(', ')}]`,
    );
  }
  if (scored.coincidence_kind === 'masked_by_unrelated') {
    failures.push(
      `masked_by_unrelated: final=${pipeline.decision.finalDecision} from unrelated incidental rules only (${hit_sources.map((h) => h.ref_id).join(', ')})`,
    );
  }
  if (nonIncidentalHits.some((h) => h.module === 'PLAYBOOK')) {
    // Gray texts should rarely hit playbook keywords; flag as observation failure for purity.
    failures.push(
      `unexpected_playbook_hit: ${nonIncidentalHits
        .filter((h) => h.module === 'PLAYBOOK')
        .map((h) => h.ref_id)
        .join(', ')}`,
    );
  }

  return {
    case_id: testCase.case_id,
    country_id: testCase.country_id,
    copy_id: testCase.copy_id,
    gray_class: testCase.gray_class,
    text: testCase.text,
    final_decision: pipeline.decision.finalDecision,
    open_risk_skipped,
    open_risk_ran,
    finding_counts: {
      rule: pipeline.decision.findingCounts.rule,
      playbook: pipeline.decision.findingCounts.playbook,
      llm: pipeline.decision.findingCounts.llm,
      vision: pipeline.decision.findingCounts.vision ?? 0,
    },
    hit_sources,
    llm_risk_types: scored.llm_risk_types,
    open_risk_capability_pass: scored.open_risk_capability_pass,
    coincidence_kind: scored.coincidence_kind,
    coincidence_only: scored.coincidence_only,
    same_risk_rule_refs: scored.same_risk_rule_refs,
    failures,
  };
}

function emptyBucket() {
  return {
    total: 0,
    capability_passed: 0,
    coincidence_only: 0,
    rule_covered_same_risk: 0,
    masked_by_unrelated: 0,
  };
}

function defaultReportsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../reports');
}

function formatMarkdown(result: GrayCopyEvalResult): string {
  const lines = [
    '# Gray-Copy Open Risk Eval',
    '',
    `**Fixture:** ${result.fixture_id}`,
    `**Evaluated at:** ${result.evaluated_at}`,
    `**Open Risk mode:** ${result.open_risk_mode}`,
    '',
    '## Metrics (capability = LLM hit OR same-risk Rule cover; NOT final_decision alone)',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Capability pass | ${result.metrics.open_risk_capability_passed}/${result.metrics.total_cases} (${(result.metrics.open_risk_capability_rate * 100).toFixed(1)}%) |`,
    `| Must-fire caught | ${result.metrics.must_fire_caught}/${result.metrics.must_fire_total} |`,
    `| rule_covered_same_risk (PASS) | ${result.metrics.rule_covered_same_risk_count} |`,
    `| masked_by_unrelated (FAIL; legacy coincidence_only) | ${result.metrics.masked_by_unrelated_count} |`,
    '',
    '## By gray class',
    '',
    '| Class | Pass | Same-risk cover | Masked unrelated |',
    '|-------|-----:|----------------:|-----------------:|',
  ];
  for (const [klass, b] of Object.entries(result.metrics.by_gray_class).sort()) {
    lines.push(
      `| ${klass} | ${b.capability_passed}/${b.total} | ${b.rule_covered_same_risk} | ${b.masked_by_unrelated} |`,
    );
  }
  lines.push('', '## Cases', '');
  for (const c of result.case_results) {
    const hit = c.hit_sources
      .map(
        (h) =>
          `${h.module}/${h.ref_id}${h.incidental ? '(incidental)' : ''}`,
      )
      .join('; ');
    const kind =
      c.coincidence_kind === 'rule_covered_same_risk'
        ? ' | RULE_COVERED'
        : c.coincidence_kind === 'masked_by_unrelated'
          ? ' | MASKED_UNRELATED'
          : '';
    lines.push(
      `- **${c.case_id}** ${c.open_risk_capability_pass ? 'PASS' : 'FAIL'} | decision=${c.final_decision} | llm=[${c.llm_risk_types.join(',') || '-'}] | hits: ${hit || 'none'}${kind}`,
    );
    if (c.failures.length) {
      lines.push(`  - ${c.failures.join(' | ')}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export type RunGrayCopyOptions = {
  fixturePath?: string;
  countries?: string[];
  copyIds?: number[];
  outputDir?: string;
  writeReports?: boolean;
};

export async function runGrayCopyEval(
  options: RunGrayCopyOptions = {},
): Promise<GrayCopyEvalResult> {
  const fixturePath = resolveGrayCopyFixturePath(options.fixturePath);
  const fixture = loadGrayCopyFixture(fixturePath);
  const cases = expandGrayCopyCases(fixture, {
    countries: options.countries,
    copyIds: options.copyIds,
  });
  const pipeline = createPipeline();
  const evaluated_at = new Date().toISOString();
  const case_results: GrayCopyCaseResult[] = [];

  for (const testCase of cases) {
    try {
      const context = buildContext(testCase);
      const result = await pipeline.runThroughReport(context);
      case_results.push(scoreCase(testCase, result));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      case_results.push({
        case_id: testCase.case_id,
        country_id: testCase.country_id,
        copy_id: testCase.copy_id,
        gray_class: testCase.gray_class,
        text: testCase.text,
        final_decision: 'ERROR',
        open_risk_skipped: false,
        open_risk_ran: false,
        finding_counts: { rule: 0, playbook: 0, llm: 0, vision: 0 },
        hit_sources: [],
        llm_risk_types: [],
        open_risk_capability_pass: false,
        coincidence_kind: null,
        coincidence_only: false,
        same_risk_rule_refs: [],
        failures: [`pipeline_error: ${message}`],
      });
    }
  }

  const by_gray_class: GrayCopyEvalResult['metrics']['by_gray_class'] = {};
  const by_country: GrayCopyEvalResult['metrics']['by_country'] = {};
  let capability = 0;
  let coincidence = 0;
  let ruleCovered = 0;
  let masked = 0;
  let mustTotal = 0;
  let mustCaught = 0;

  for (const c of case_results) {
    if (c.open_risk_capability_pass) capability += 1;
    if (c.coincidence_only) coincidence += 1;
    if (c.coincidence_kind === 'rule_covered_same_risk') ruleCovered += 1;
    if (c.coincidence_kind === 'masked_by_unrelated') masked += 1;
    const tpl = fixture.cases.find((x) => x.copy_id === c.copy_id);
    if (tpl?.open_risk_must_fire) {
      mustTotal += 1;
      if (c.open_risk_capability_pass) mustCaught += 1;
    }
    const g = (by_gray_class[c.gray_class] ??= emptyBucket());
    g.total += 1;
    if (c.open_risk_capability_pass) g.capability_passed += 1;
    if (c.coincidence_only) g.coincidence_only += 1;
    if (c.coincidence_kind === 'rule_covered_same_risk') g.rule_covered_same_risk += 1;
    if (c.coincidence_kind === 'masked_by_unrelated') g.masked_by_unrelated += 1;
    const country = (by_country[c.country_id] ??= emptyBucket());
    country.total += 1;
    if (c.open_risk_capability_pass) country.capability_passed += 1;
    if (c.coincidence_only) country.coincidence_only += 1;
    if (c.coincidence_kind === 'rule_covered_same_risk') {
      country.rule_covered_same_risk += 1;
    }
    if (c.coincidence_kind === 'masked_by_unrelated') {
      country.masked_by_unrelated += 1;
    }
  }

  const evalResult: GrayCopyEvalResult = {
    fixture_id: fixture.fixture_id,
    evaluated_at,
    open_risk_mode: process.env.AAIRP_OPEN_RISK_MODE?.trim() || '(unset→stub)',
    case_results,
    metrics: {
      total_cases: case_results.length,
      open_risk_capability_passed: capability,
      open_risk_capability_rate:
        case_results.length === 0 ? 0 : capability / case_results.length,
      coincidence_only_count: coincidence,
      rule_covered_same_risk_count: ruleCovered,
      masked_by_unrelated_count: masked,
      must_fire_total: mustTotal,
      must_fire_caught: mustCaught,
      by_gray_class,
      by_country,
    },
    failed_case_ids: case_results
      .filter((c) => !c.open_risk_capability_pass)
      .map((c) => c.case_id),
  };

  if (options.writeReports !== false) {
    const outputDir = options.outputDir ?? defaultReportsDir();
    mkdirSync(outputDir, { recursive: true });
    const stamp = evaluated_at.replace(/[:.]/g, '-');
    writeFileSync(
      join(outputDir, `eval-gray-copy-${stamp}.json`),
      `${JSON.stringify(evalResult, null, 2)}\n`,
    );
    writeFileSync(
      join(outputDir, `eval-gray-copy-${stamp}.md`),
      formatMarkdown(evalResult),
    );
  }

  return evalResult;
}
