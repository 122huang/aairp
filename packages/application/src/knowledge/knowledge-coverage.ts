import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBenchmarkV2, strictLinkageCases } from './load-benchmark-v2.js';
import { validateKnowledgeLinkage, type LinkageValidationResult } from './linkage-validator.js';
import { loadSkillModules, listModulePatternIds } from './skill-modules.js';
import { parsePlaybookMarkdown } from '../review/playbook-engine.service.js';

export type KnowledgeInventory = {
  regulations: number;
  rules: number;
  skill_patterns: number;
  benchmark_cases: number;
  benchmark_strict_cases: number;
  case_library_records: number;
};

export type CoveragePercentages = {
  patterns_with_benchmark_pct: number;
  rules_with_benchmark_pct: number;
  strict_cases_fully_linked_pct: number;
  playbook_patterns_with_skill_module_pct: number;
  golden_issues_mapped_pct: number;
};

export type KnowledgeCoverageReport = {
  generated_at: string;
  knowledge_pack_version: string | null;
  knowledge_pack_fingerprint: string | null;
  taxonomy_version: string;
  inventory: KnowledgeInventory;
  coverage: CoveragePercentages;
  linkage: Pick<
    LinkageValidationResult,
    'passed' | 'error_count' | 'warn_count' | 'orphans'
  >;
  recommendations: string[];
};

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function countRegulations(): number {
  const manifestPath = join(repoRoot(), 'apps/admin-ui/public/knowledge-manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        regulations?: unknown[];
      };
      if (manifest.regulations?.length) {
        return manifest.regulations.length;
      }
    } catch {
      // fall through to demo seed count
    }
  }
  return 3;
}

function countRules(): number {
  const rulesPath = join(repoRoot(), 'demo/rules.demo.json');
  const pack = JSON.parse(readFileSync(rulesPath, 'utf8')) as { rules: unknown[] };
  return pack.rules.length;
}

function countCaseLibraryRecords(): number {
  const caseRoot = join(repoRoot(), 'case-library/cases');
  if (!existsSync(caseRoot)) {
    return 0;
  }
  let count = 0;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.json') && entry.name.startsWith('case_')) {
        count += 1;
      }
    }
  };
  walk(caseRoot);
  return count;
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 100;
  }
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function buildKnowledgeCoverageReport(): KnowledgeCoverageReport {
  const taxonomy = loadSkillModules();
  const benchmark = loadBenchmarkV2();
  const strictCases = strictLinkageCases(benchmark);
  const linkage = validateKnowledgeLinkage({ modules: taxonomy });
  const playbook = parsePlaybookMarkdown(
    readFileSync(join(repoRoot(), 'demo/playbook.demo.md'), 'utf8'),
  );

  const taxonomyPatternIds = listModulePatternIds(taxonomy);
  const patternsWithBenchmark = new Set(
    strictCases.map((c) => c.pattern_id).filter((id): id is string => Boolean(id)),
  );
  const rulesWithBenchmark = new Set(
    strictCases.map((c) => c.expected_rule).filter((id): id is string => Boolean(id)),
  );
  const rulesPath = join(repoRoot(), 'demo/rules.demo.json');
  const ruleIds = (JSON.parse(readFileSync(rulesPath, 'utf8')) as { rules: Array<{ rule_id: string }> }).rules.map(
    (r) => r.rule_id,
  );

  const fullyLinkedStrict = strictCases.filter(
    (c) => c.skill_module && c.pattern_id && c.expected_rule && c.expected_decision,
  ).length;

  const playbookWithModule = playbook.items.filter((item) => item.skillModule).length;

  const goldenPath = join(repoRoot(), 'scripts/golden-benchmark-v1-cases.json');
  const goldenIssues = [
    ...new Set(
      (JSON.parse(readFileSync(goldenPath, 'utf8')) as Array<{ issue: string }>).map((c) => c.issue),
    ),
  ];
  const mappedGoldenIssues = goldenIssues.filter((issue) => taxonomy.golden_issue_map[issue]).length;

  let knowledge_pack_version: string | null = null;
  let knowledge_pack_fingerprint: string | null = null;
  const packManifestPath = join(repoRoot(), 'benchmark/knowledge-pack.manifest.json');
  if (existsSync(packManifestPath)) {
    const pack = JSON.parse(readFileSync(packManifestPath, 'utf8')) as {
      knowledge_pack_version?: string;
      knowledge_pack_fingerprint?: string;
    };
    knowledge_pack_version = pack.knowledge_pack_version ?? null;
    knowledge_pack_fingerprint = pack.knowledge_pack_fingerprint ?? null;
  }

  const inventory: KnowledgeInventory = {
    regulations: countRegulations(),
    rules: countRules(),
    skill_patterns: taxonomyPatternIds.length,
    benchmark_cases: benchmark.cases.length,
    benchmark_strict_cases: strictCases.length,
    case_library_records: countCaseLibraryRecords(),
  };

  const coverage: CoveragePercentages = {
    patterns_with_benchmark_pct: pct(patternsWithBenchmark.size, taxonomyPatternIds.length),
    rules_with_benchmark_pct: pct(rulesWithBenchmark.size, ruleIds.length),
    strict_cases_fully_linked_pct: pct(fullyLinkedStrict, strictCases.length),
    playbook_patterns_with_skill_module_pct: pct(playbookWithModule, playbook.items.length),
    golden_issues_mapped_pct: pct(mappedGoldenIssues, goldenIssues.length),
  };

  const recommendations: string[] = [];
  if (linkage.orphans.patterns_without_benchmark.length > 0) {
    recommendations.push(
      `Add benchmark cases for patterns: ${linkage.orphans.patterns_without_benchmark.join(', ')}`,
    );
  }
  if (linkage.orphans.rules_without_benchmark.length > 0) {
    recommendations.push(
      `Add benchmark cases for rules: ${linkage.orphans.rules_without_benchmark.slice(0, 5).join(', ')}${linkage.orphans.rules_without_benchmark.length > 5 ? '…' : ''}`,
    );
  }
  if (coverage.playbook_patterns_with_skill_module_pct < 100) {
    recommendations.push('Backfill skill_module on all playbook patterns.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Knowledge linkage foundation is healthy for Sprint 3 scope.');
  }

  return {
    generated_at: new Date().toISOString(),
    knowledge_pack_version,
    knowledge_pack_fingerprint,
    taxonomy_version: taxonomy.modules_version,
    inventory,
    coverage,
    linkage: {
      passed: linkage.passed,
      error_count: linkage.error_count,
      warn_count: linkage.warn_count,
      orphans: linkage.orphans,
    },
    recommendations,
  };
}

export function formatCoverageMarkdown(report: KnowledgeCoverageReport): string {
  return [
    '# Knowledge Coverage Report',
    '',
    `**Generated at:** ${report.generated_at}`,
    `**Knowledge Pack:** ${report.knowledge_pack_version ?? '(not generated yet)'}`,
    `**Fingerprint:** ${report.knowledge_pack_fingerprint ?? '(not generated yet)'}`,
    `**Taxonomy:** ${report.taxonomy_version}`,
    '',
    '## Inventory',
    '',
    '| Object | Count |',
    '|--------|------:|',
    `| Regulations | ${report.inventory.regulations} |`,
    `| Rules | ${report.inventory.rules} |`,
    `| Skill Patterns | ${report.inventory.skill_patterns} |`,
    `| Benchmark Cases (total) | ${report.inventory.benchmark_cases} |`,
    `| Benchmark Cases (strict linkage) | ${report.inventory.benchmark_strict_cases} |`,
    `| Case Library Records | ${report.inventory.case_library_records} |`,
    '',
    '## Coverage',
    '',
    '| Metric | % |',
    '|--------|----:|',
    `| Patterns with benchmark | ${report.coverage.patterns_with_benchmark_pct} |`,
    `| Rules with benchmark | ${report.coverage.rules_with_benchmark_pct} |`,
    `| Strict cases fully linked | ${report.coverage.strict_cases_fully_linked_pct} |`,
    `| Playbook patterns with skill_module | ${report.coverage.playbook_patterns_with_skill_module_pct} |`,
    `| Golden issues mapped | ${report.coverage.golden_issues_mapped_pct} |`,
    '',
    '## Linkage Status',
    '',
    `- Passed: ${report.linkage.passed}`,
    `- Errors: ${report.linkage.error_count}`,
    `- Warnings: ${report.linkage.warn_count}`,
    '',
    '## Recommendations',
    '',
    ...report.recommendations.map((item) => `- ${item}`),
    '',
  ].join('\n');
}
