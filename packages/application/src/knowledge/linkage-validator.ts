import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePlaybookMarkdown } from '../review/playbook-engine.service.js';
import { loadBenchmarkV2, strictLinkageCases, type BenchmarkV2Case } from './load-benchmark-v2.js';
import { loadBenchmarkV3, type BenchmarkV3Case } from '../evaluation/load-benchmark-v3.js';
import {
  listModulePatternIds,
  loadSkillModules,
  resolvePatternRuleLinks,
  type SkillModulesDocument,
} from './skill-modules.js';
import {
  type DemoRuleEntry,
  validateRulePlaybookTermSync,
} from './rule-playbook-term-sync.js';
import {
  isLegacyPattern,
  isRuleExcludedFromStrictLinkage,
  loadLinkageValidatorConfig,
} from './linkage-validator-config.js';

export type LinkageIssue = {
  rule_id: string;
  severity: 'error' | 'warn';
  object_type: 'pattern' | 'rule' | 'benchmark_case' | 'regulation' | 'playbook';
  object_id: string;
  message: string;
};

export type LinkageValidationResult = {
  validated_at: string;
  knowledge_pack_version: string | null;
  strict_mode: boolean;
  passed: boolean;
  issue_count: number;
  error_count: number;
  warn_count: number;
  issues: LinkageIssue[];
  orphans: {
    patterns_without_benchmark: string[];
    rules_without_benchmark: string[];
    benchmark_cases_incomplete: string[];
  };
};

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

function loadRules(): DemoRuleEntry[] {
  const rulesPath = join(repoRoot, 'demo/rules.demo.json');
  const pack = JSON.parse(readFileSync(rulesPath, 'utf8')) as { rules: DemoRuleEntry[] };
  return pack.rules;
}

function loadRegulationManifest(): Array<{ regulation_key: string; linked_rules: string[] }> {
  const manifestPath = join(repoRoot, 'apps/admin-ui/public/knowledge-manifest.json');
  if (!existsSync(manifestPath)) {
    return [];
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      regulations?: Array<{ regulation_key: string; linked_rules: string[] }>;
    };
    return manifest.regulations ?? [];
  } catch {
    return [];
  }
}

function loadKnowledgePackVersion(): string | null {
  const manifestPath = join(repoRoot, 'benchmark/knowledge-pack.manifest.json');
  if (!existsSync(manifestPath)) {
    return null;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    knowledge_pack_version?: string;
  };
  return manifest.knowledge_pack_version ?? null;
}

function validateBenchmarkCaseFields(benchmarkCase: BenchmarkV2Case): string[] {
  const missing: string[] = [];
  if (!benchmarkCase.skill_module) missing.push('skill_module');
  if (!benchmarkCase.expected_decision) missing.push('expected_decision');
  if (!benchmarkCase.pattern_id && !benchmarkCase.expected_rule) {
    missing.push('pattern_id or expected_rule');
  }
  return missing;
}

function v3CaseToLinkageCase(benchmarkCase: BenchmarkV3Case): BenchmarkV2Case {
  return {
    case_id: benchmarkCase.case_id,
    skill_module: benchmarkCase.expected_skill,
    pattern_id: benchmarkCase.expected_pattern,
    expected_rule: benchmarkCase.expected_rule,
    expected_decision: benchmarkCase.expected_decision,
    expected_severity: benchmarkCase.expected_severity,
    verified_by_legal: benchmarkCase.verified_by_legal,
    exclude_from_strict_linkage: benchmarkCase.exclude_from_strict_linkage,
    text: benchmarkCase.text,
    risk: benchmarkCase.risk ?? '',
    issue: benchmarkCase.issue ?? '',
    modality: benchmarkCase.modality,
    provenance: {
      source: benchmarkCase.provenance.source ?? 'benchmark-v3',
      golden_id: benchmarkCase.case_id,
      generated_at: benchmarkCase.provenance.v3_generated_at ?? '',
    },
  };
}

function loadStrictLinkageBenchmarkCases(): BenchmarkV2Case[] {
  const v2Cases = strictLinkageCases(loadBenchmarkV2());
  const localeExpansionCases = loadBenchmarkV3()
    .cases.filter(
      (benchmarkCase) =>
        benchmarkCase.tier === 'locale-expansion' &&
        !benchmarkCase.exclude_from_strict_linkage &&
        (benchmarkCase.expected_rule || benchmarkCase.expected_pattern),
    )
    .map(v3CaseToLinkageCase);
  return [...v2Cases, ...localeExpansionCases];
}

export function validateKnowledgeLinkage(options?: {
  strict?: boolean;
  modules?: SkillModulesDocument;
}): LinkageValidationResult {
  const strict = options?.strict ?? false;
  const modules = options?.modules ?? loadSkillModules();
  const strictCases = loadStrictLinkageBenchmarkCases();
  const taxonomyPatternIds = listModulePatternIds(modules);
  const playbookPath = join(repoRoot, 'demo/playbook.demo.md');
  const playbook = parsePlaybookMarkdown(readFileSync(playbookPath, 'utf8'));
  const rules = loadRules();
  const ruleIds = new Set(rules.map((rule) => rule.rule_id));
  const linkageConfig = loadLinkageValidatorConfig();

  const issues: LinkageIssue[] = [];
  const patternsWithBenchmark = new Set<string>();
  const rulesWithBenchmark = new Set<string>();

  for (const benchmarkCase of strictCases) {
    if (benchmarkCase.pattern_id) {
      patternsWithBenchmark.add(benchmarkCase.pattern_id);
    }
    if (benchmarkCase.expected_rule) {
      rulesWithBenchmark.add(benchmarkCase.expected_rule);
    }

    const missing = validateBenchmarkCaseFields(benchmarkCase);
    if (missing.length > 0) {
      issues.push({
        rule_id: 'L2',
        severity: 'error',
        object_type: 'benchmark_case',
        object_id: benchmarkCase.case_id,
        message: `Missing linkage fields: ${missing.join(', ')}`,
      });
    }

    if (benchmarkCase.pattern_id && !taxonomyPatternIds.includes(benchmarkCase.pattern_id)) {
      issues.push({
        rule_id: 'L3',
        severity: 'error',
        object_type: 'benchmark_case',
        object_id: benchmarkCase.case_id,
        message: `Unknown pattern_id: ${benchmarkCase.pattern_id}`,
      });
    }

    if (benchmarkCase.expected_rule && !ruleIds.has(benchmarkCase.expected_rule)) {
      issues.push({
        rule_id: 'L4',
        severity: 'error',
        object_type: 'benchmark_case',
        object_id: benchmarkCase.case_id,
        message: `Unknown expected_rule: ${benchmarkCase.expected_rule}`,
      });
    }
  }

  for (const patternId of taxonomyPatternIds) {
    if (!patternsWithBenchmark.has(patternId)) {
      const legacy = isLegacyPattern(patternId, linkageConfig);
      issues.push({
        rule_id: legacy ? 'L1-legacy' : 'L1',
        severity: legacy ? 'warn' : 'error',
        object_type: 'pattern',
        object_id: patternId,
        message: legacy
          ? 'No strict benchmark case references this legacy pattern'
          : 'No strict benchmark case references this pattern',
      });
    }
  }

  for (const item of playbook.items) {
    if (!item.skillModule) {
      issues.push({
        rule_id: 'L5',
        severity: 'error',
        object_type: 'playbook',
        object_id: item.patternId,
        message: 'Playbook pattern missing skill_module metadata',
      });
    }
  }

  for (const rule of rules) {
    if (isRuleExcludedFromStrictLinkage(rule.rule_id, linkageConfig)) {
      continue;
    }
    if (!rulesWithBenchmark.has(rule.rule_id)) {
      issues.push({
        rule_id: 'L4-soft',
        severity: 'warn',
        object_type: 'rule',
        object_id: rule.rule_id,
        message: 'No strict benchmark case references this rule',
      });
    }
  }

  for (const regulation of loadRegulationManifest()) {
    for (const linkedRule of regulation.linked_rules ?? []) {
      if (!ruleIds.has(linkedRule)) {
        issues.push({
          rule_id: 'L6',
          severity: 'warn',
          object_type: 'regulation',
          object_id: regulation.regulation_key,
          message: `linked_rules references unknown rule: ${linkedRule}`,
        });
      }
    }
  }

  const playbookPatternIds = playbook.items.map((item) => item.patternId);
  const patternRuleLinks = resolvePatternRuleLinks(modules, playbookPatternIds, strictCases);
  const termSyncIssues = validateRulePlaybookTermSync({
    playbook,
    rules,
    patternRuleLinks,
  });

  for (const syncIssue of termSyncIssues) {
    issues.push({
      rule_id: syncIssue.code,
      severity: syncIssue.code === 'L7' ? 'error' : 'warn',
      object_type: 'playbook',
      object_id: syncIssue.pattern_id,
      message: `[${syncIssue.rule_id}] ${syncIssue.message}`,
    });
  }

  const error_count = issues.filter((issue) => issue.severity === 'error').length;
  const warn_count = issues.filter((issue) => issue.severity === 'warn').length;
  const passed = strict ? error_count === 0 && warn_count === 0 : error_count === 0;

  return {
    validated_at: new Date().toISOString(),
    knowledge_pack_version: loadKnowledgePackVersion(),
    strict_mode: strict,
    passed,
    issue_count: issues.length,
    error_count,
    warn_count,
    issues,
    orphans: {
      patterns_without_benchmark: taxonomyPatternIds.filter((id) => !patternsWithBenchmark.has(id)),
      rules_without_benchmark: rules.map((r) => r.rule_id).filter((id) => !rulesWithBenchmark.has(id)),
      benchmark_cases_incomplete: strictCases
        .filter((c) => validateBenchmarkCaseFields(c).length > 0)
        .map((c) => c.case_id),
    },
  };
}

export function formatLinkageMarkdown(result: LinkageValidationResult): string {
  const lines = [
    '# Knowledge Linkage Report',
    '',
    `**Validated at:** ${result.validated_at}`,
    `**Knowledge Pack:** ${result.knowledge_pack_version ?? '(not generated yet)'}`,
    `**Strict mode:** ${result.strict_mode}`,
    `**Result:** ${result.passed ? 'PASSED' : 'FAILED'} (${result.error_count} errors, ${result.warn_count} warnings)`,
    '',
    '## Orphan Summary',
    '',
    `- Patterns without benchmark: ${result.orphans.patterns_without_benchmark.length}`,
    `- Rules without benchmark: ${result.orphans.rules_without_benchmark.length}`,
    `- Incomplete benchmark cases: ${result.orphans.benchmark_cases_incomplete.length}`,
    '',
  ];

  if (result.issues.length === 0) {
    lines.push('No linkage issues found.');
    return lines.join('\n');
  }

  lines.push('## Issues', '', '| Rule | Severity | Type | ID | Message |', '|------|----------|------|-----|---------|');
  for (const issue of result.issues) {
    lines.push(
      `| ${issue.rule_id} | ${issue.severity} | ${issue.object_type} | ${issue.object_id} | ${issue.message} |`,
    );
  }
  return lines.join('\n');
}
