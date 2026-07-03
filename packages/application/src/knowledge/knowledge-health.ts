import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateKnowledgeLinkage } from './linkage-validator.js';
import { loadSkillModules } from './skill-modules.js';
import { buildKnowledgeCoverageReport, formatCoverageMarkdown } from './knowledge-coverage.js';
import type { FreshnessStatus } from './ownership.js';
import { loadBenchmarkV3Baseline } from '../evaluation/benchmark-v3-baseline.js';
import type { BenchmarkV3EvalResult } from '../evaluation/benchmark-v3-evaluator.service.js';
import { compareToBaseline } from '../evaluation/benchmark-v3-baseline.js';
import { buildKnowledgePlatformSnapshot } from './platform/knowledge-platform.js';
import { buildRegulationCoverageReport } from './regulation-corpus-coverage.js';

export type KnowledgeHealthReport = ReturnType<typeof buildKnowledgeHealthReport>;

export type RegulationCorpusHealthSummary = {
  corpus_size: number;
  knowledge_quality_score: number;
  freshness: {
    green: number;
    yellow: number;
    red: number;
    green_pct: number;
    yellow_pct: number;
    red_pct: number;
  };
  ownership_coverage_pct: number;
  rule_linkage_pct: number;
  validation_errors: number;
  governance_warnings: number;
};

export type SkillModuleHealthRow = {
  skill_module: string;
  skill_quality_score: number | null;
  regression_status: 'pass' | 'partial' | 'fail' | 'not_evaluated';
  benchmark_confidence: 'high' | 'medium' | 'low' | 'none';
  ownership_status: {
    owner: string | null;
    owner_type: string | null;
    freshness_status: FreshnessStatus | null;
  };
  case_count: number;
};

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function findLatestEvalV3Report(): BenchmarkV3EvalResult | null {
  const reportsDir = join(repoRoot(), 'reports');
  if (!existsSync(reportsDir)) {
    return null;
  }
  const files = readdirSync(reportsDir)
    .filter((f) => f.startsWith('eval-v3-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(join(reportsDir, files[0]!), 'utf8')) as BenchmarkV3EvalResult;
  } catch {
    return null;
  }
}

function findLatestEvalV3Score(): number | null {
  return findLatestEvalV3Report()?.metrics.weighted_quality_score ?? null;
}

function buildSkillModuleHealth(
  evalReport: BenchmarkV3EvalResult | null,
  legalVerifiedPct: number,
): SkillModuleHealthRow[] {
  const modules = loadSkillModules();
  const moduleScoreMap = new Map(
    (evalReport?.metrics.module_scores ?? []).map((m) => [m.skill_module, m]),
  );

  return modules.modules.map((mod) => {
    const score = moduleScoreMap.get(mod.skill_module);
    let regression_status: SkillModuleHealthRow['regression_status'] = 'not_evaluated';
    let benchmark_confidence: SkillModuleHealthRow['benchmark_confidence'] = 'none';
    if (score) {
      if (score.passed_cases === score.case_count && score.decision_accuracy >= 1) {
        regression_status = 'pass';
      } else if (score.decision_accuracy >= 0.9) {
        regression_status = 'partial';
      } else {
        regression_status = 'fail';
      }
      if (score.case_count >= 3 && score.decision_accuracy >= 1 && legalVerifiedPct >= 90) {
        benchmark_confidence = 'high';
      } else if (score.case_count >= 1 && score.decision_accuracy >= 0.9) {
        benchmark_confidence = 'medium';
      } else {
        benchmark_confidence = 'low';
      }
    }

    return {
      skill_module: mod.skill_module,
      skill_quality_score: score?.weighted_score ?? null,
      regression_status,
      benchmark_confidence,
      ownership_status: {
        owner: mod.owner ?? null,
        owner_type: mod.owner_type ?? null,
        freshness_status: mod.freshness_status ?? null,
      },
      case_count: score?.case_count ?? 0,
    };
  });
}

export function buildKnowledgeHealthReport() {
  const coverage = buildKnowledgeCoverageReport();
  const modules = loadSkillModules();
  const linkage = validateKnowledgeLinkage();

  const modulesWithOwner = modules.modules.filter((m) => m.owner).length;
  const ownership_coverage_pct =
    modules.modules.length === 0 ? 100 : (modulesWithOwner / modules.modules.length) * 100;

  const freshnessCounts: Record<FreshnessStatus, number> = {
    current: 0,
    review_due: 0,
    stale: 0,
    deprecated: 0,
  };
  for (const mod of modules.modules) {
    freshnessCounts[mod.freshness_status] += 1;
  }

  const benchmarkPassRate = findLatestEvalV3Score();
  const latestEval = findLatestEvalV3Report();
  const baseline = loadBenchmarkV3Baseline();
  const regressionComparison = latestEval ? compareToBaseline(baseline, latestEval) : null;

  const skill_modules = buildSkillModuleHealth(latestEval, baseline.regression_tier.legal_verified_pct);

  const objectsMissingOwner = modules.modules
    .filter((m) => !m.owner)
    .map((m) => ({ object_type: 'skill_module', object_id: m.skill_module }));

  const recommendations = [...coverage.recommendations];
  if (ownership_coverage_pct < 100) {
    recommendations.push('Assign owner to all skill modules.');
  }
  if (benchmarkPassRate !== null && benchmarkPassRate < 0.85) {
    recommendations.push(`Benchmark v3 weighted score ${(benchmarkPassRate * 100).toFixed(1)}% is below 85% target.`);
  }
  if (freshnessCounts.stale > 0) {
    recommendations.push(`${freshnessCounts.stale} skill module(s) marked stale — schedule review.`);
  }

  let regulation_corpus: RegulationCorpusHealthSummary | null = null;
  try {
    const platform = buildKnowledgePlatformSnapshot();
    const regulation = platform.corpora.find((corpus) => corpus.corpus_type === 'regulation');
    if (regulation) {
      regulation_corpus = {
        corpus_size: regulation.entry_count,
        knowledge_quality_score: regulation.knowledge_quality_score,
        freshness: regulation.freshness,
        ownership_coverage_pct: 100,
        rule_linkage_pct: 0,
        validation_errors: regulation.validation_errors,
        governance_warnings: regulation.governance_warnings,
      };
      const coverage = buildRegulationCoverageReport();
      regulation_corpus.rule_linkage_pct = coverage.linkage_coverage.rule_linkage_pct;
      regulation_corpus.ownership_coverage_pct = coverage.ownership.coverage_pct;
    }
    if (regulation && regulation.governance_warnings > 0) {
      recommendations.push(
        `${regulation.governance_warnings} regulation corpus governance warning(s) — see knowledge:regulation-dashboard.`,
      );
    }
  } catch {
    regulation_corpus = null;
  }

  return {
    ...coverage,
    accountability: {
      ownership_coverage_pct: Math.round(ownership_coverage_pct * 10) / 10,
      objects_missing_owner: objectsMissingOwner,
      freshness_distribution: freshnessCounts,
      modules_version: modules.modules_version,
    },
    effectiveness: {
      benchmark_pass_rate: benchmarkPassRate,
      linkage_errors: linkage.error_count,
      linkage_warnings: linkage.warn_count,
      false_positive_fn_note: 'See latest eval-v3 report for FP/FN module breakdown (Sprint 4B).',
    },
    regression: {
      baseline_id: baseline.baseline_id,
      tier: 'regression',
      tier_size: baseline.regression_tier.case_count,
      status: regressionComparison?.regression_status ?? 'unknown',
      legal_verified_pct: baseline.regression_tier.legal_verified_pct,
      known_limitations: baseline.known_limitations,
    },
    benchmark_confidence: {
      overall:
        latestEval && latestEval.metrics.decision_accuracy >= 1
          ? baseline.regression_tier.legal_verified_pct >= 100
            ? 'high'
            : 'medium'
          : 'low',
      severity_gating_enabled: false,
      tier_expansion_required: baseline.regression_tier.case_count < 15,
    },
    skill_modules,
    regulation_corpus,
    recommendations,
  };
}

export function formatHealthMarkdown(report: ReturnType<typeof buildKnowledgeHealthReport>): string {
  const coverageMd = formatCoverageMarkdown(report);
  const lines = [
    coverageMd,
    '',
    '## Accountability',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Ownership coverage | ${report.accountability.ownership_coverage_pct}% |`,
    `| Modules version | ${report.accountability.modules_version} |`,
    `| Freshness: current | ${report.accountability.freshness_distribution.current} |`,
    `| Freshness: review_due | ${report.accountability.freshness_distribution.review_due} |`,
    `| Freshness: stale | ${report.accountability.freshness_distribution.stale} |`,
    '',
    '## Effectiveness',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Benchmark pass rate (v3) | ${report.effectiveness.benchmark_pass_rate === null ? 'n/a' : `${(report.effectiveness.benchmark_pass_rate * 100).toFixed(1)}%`} |`,
    `| Linkage errors | ${report.effectiveness.linkage_errors} |`,
    `| Linkage warnings | ${report.effectiveness.linkage_warnings} |`,
    '',
    '## Regression Baseline',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Baseline ID | ${report.regression.baseline_id} |`,
    `| Regression status | ${report.regression.status} |`,
    `| Tier size | ${report.regression.tier_size} cases |`,
    `| Legal verified | ${report.regression.legal_verified_pct}% |`,
    `| Benchmark confidence | ${report.benchmark_confidence.overall} |`,
    '',
    '## Skill Module Quality',
    '',
    '| Module | Quality | Regression | Confidence | Owner | Freshness |',
    '|--------|--------:|------------|------------|-------|-----------|',
  ];

  for (const mod of report.skill_modules) {
    lines.push(
      `| ${mod.skill_module} | ${mod.skill_quality_score === null ? 'n/a' : `${(mod.skill_quality_score * 100).toFixed(1)}%`} | ${mod.regression_status} | ${mod.benchmark_confidence} | ${mod.ownership_status.owner ?? '—'} | ${mod.ownership_status.freshness_status ?? '—'} |`,
    );
  }

  if (report.regulation_corpus) {
    lines.push(
      '',
      '## Regulation Corpus (reporting only)',
      '',
      '| Metric | Value |',
      '|--------|------:|',
      `| Corpus size | ${report.regulation_corpus.corpus_size} |`,
      `| Knowledge Quality Score | ${report.regulation_corpus.knowledge_quality_score}% |`,
      `| Freshness green | ${report.regulation_corpus.freshness.green} |`,
      `| Freshness yellow | ${report.regulation_corpus.freshness.yellow} |`,
      `| Freshness red | ${report.regulation_corpus.freshness.red} |`,
      `| Ownership coverage | ${report.regulation_corpus.ownership_coverage_pct}% |`,
      `| Rule linkage | ${report.regulation_corpus.rule_linkage_pct}% |`,
      `| Governance warnings | ${report.regulation_corpus.governance_warnings} |`,
    );
  }

  lines.push(
    '',
    '## Known Baseline Limitations',
    '',
    ...report.regression.known_limitations.map((item) => `- ${item}`),
  );

  if (report.accountability.objects_missing_owner.length > 0) {
    lines.push('', '## Objects Missing Owner', '');
    for (const obj of report.accountability.objects_missing_owner) {
      lines.push(`- ${obj.object_type}: ${obj.object_id}`);
    }
  }

  return lines.join('\n');
}

export function writeKnowledgeHealthReport(): ReturnType<typeof buildKnowledgeHealthReport> {
  const report = buildKnowledgeHealthReport();
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  const reportsDir = join(repoRoot(), 'reports');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `knowledge-health-${timestamp}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(
    join(reportsDir, `knowledge-health-${timestamp}.md`),
    `${formatHealthMarkdown(report)}\n`,
  );
  return report;
}
