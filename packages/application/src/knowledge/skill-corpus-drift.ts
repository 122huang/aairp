import { loadSkillModules } from './skill-modules.js';
import { loadSkillCorpusEntries, type SkillCorpusEntry } from './skill-corpus.js';

export type SkillDriftIssue = {
  severity: 'warn';
  code: string;
  skill_id: string;
  message: string;
};

export type SkillDriftReport = {
  generated_at: string;
  skill_corpus_count: number;
  legacy_module_count: number;
  legacy_pattern_count: number;
  issues: SkillDriftIssue[];
  summary: {
    skills_with_legacy_module: number;
    skills_with_pattern_drift: number;
    skills_with_rule_drift: number;
    unmapped_legacy_patterns: string[];
  };
};

function collectLegacyPatterns(): Map<string, Set<string>> {
  const doc = loadSkillModules();
  const byModule = new Map<string, Set<string>>();
  for (const module of doc.modules) {
    byModule.set(
      module.skill_module,
      new Set(module.patterns.map((pattern) => pattern.pattern_id)),
    );
  }
  return byModule;
}

function collectLegacyRules(): Map<string, Set<string>> {
  const doc = loadSkillModules();
  const byModule = new Map<string, Set<string>>();
  for (const module of doc.modules) {
    byModule.set(module.skill_module, new Set(module.applicable_rules));
  }
  return byModule;
}

export function buildSkillDriftReport(options?: {
  customRoot?: string;
  now?: Date;
}): SkillDriftReport {
  const now = options?.now ?? new Date();
  const entries = loadSkillCorpusEntries(options?.customRoot);
  const legacyDoc = loadSkillModules();
  const legacyPatterns = collectLegacyPatterns();
  const legacyRules = collectLegacyRules();
  const issues: SkillDriftIssue[] = [];

  let skillsWithLegacyModule = 0;
  let skillsWithPatternDrift = 0;
  let skillsWithRuleDrift = 0;

  const corpusPatternIds = new Set<string>();
  for (const entry of entries) {
    for (const patternId of entry.legacy_pattern_ids ?? []) {
      corpusPatternIds.add(patternId);
    }
  }

  const allLegacyPatternIds = new Set<string>();
  for (const patterns of legacyPatterns.values()) {
    for (const patternId of patterns) {
      allLegacyPatternIds.add(patternId);
    }
  }

  for (const entry of entries) {
    if (!entry.legacy_skill_module) {
      issues.push({
        severity: 'warn',
        code: 'missing_legacy_skill_module',
        skill_id: entry.skill_id,
        message: 'Skill entry has no legacy_skill_module bridge to skill-modules.json',
      });
      continue;
    }

    skillsWithLegacyModule += 1;
    const modulePatterns = legacyPatterns.get(entry.legacy_skill_module);
    if (!modulePatterns) {
      issues.push({
        severity: 'warn',
        code: 'unknown_legacy_skill_module',
        skill_id: entry.skill_id,
        message: `legacy_skill_module not found in skill-modules.json: ${entry.legacy_skill_module}`,
      });
      continue;
    }

    for (const patternId of entry.legacy_pattern_ids ?? []) {
      if (!modulePatterns.has(patternId)) {
        skillsWithPatternDrift += 1;
        issues.push({
          severity: 'warn',
          code: 'legacy_pattern_not_in_module',
          skill_id: entry.skill_id,
          message: `legacy_pattern_ids ${patternId} not in module ${entry.legacy_skill_module}`,
        });
      }
    }

    const moduleRules = legacyRules.get(entry.legacy_skill_module);
    if (moduleRules) {
      const corpusRules = new Set(entry.linkage.rules ?? []);
      for (const ruleId of corpusRules) {
        if (!moduleRules.has(ruleId)) {
          skillsWithRuleDrift += 1;
          issues.push({
            severity: 'warn',
            code: 'rule_not_in_legacy_module',
            skill_id: entry.skill_id,
            message: `linkage.rules ${ruleId} not listed in legacy applicable_rules for ${entry.legacy_skill_module}`,
          });
        }
      }
    }
  }

  const unmappedLegacyPatterns = [...allLegacyPatternIds].filter(
    (patternId) => !corpusPatternIds.has(patternId),
  );

  for (const patternId of unmappedLegacyPatterns) {
    issues.push({
      severity: 'warn',
      code: 'unmapped_legacy_pattern',
      skill_id: '(corpus)',
      message: `Legacy pattern ${patternId} has no skill corpus entry via legacy_pattern_ids`,
    });
  }

  return {
    generated_at: now.toISOString(),
    skill_corpus_count: entries.length,
    legacy_module_count: legacyDoc.modules.length,
    legacy_pattern_count: allLegacyPatternIds.size,
    issues,
    summary: {
      skills_with_legacy_module: skillsWithLegacyModule,
      skills_with_pattern_drift: skillsWithPatternDrift,
      skills_with_rule_drift: skillsWithRuleDrift,
      unmapped_legacy_patterns: unmappedLegacyPatterns,
    },
  };
}

export function formatSkillDriftMarkdown(report: SkillDriftReport): string {
  const lines = [
    '# Skill Corpus Drift Report',
    '',
    `Generated: ${report.generated_at}`,
    '',
    'Non-blocking governance comparison between Skill Corpus and `skill-modules.json`.',
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '|--------|------:|',
    `| Skill corpus entries | ${report.skill_corpus_count} |`,
    `| Legacy modules | ${report.legacy_module_count} |`,
    `| Legacy patterns | ${report.legacy_pattern_count} |`,
    `| Skills with legacy module bridge | ${report.summary.skills_with_legacy_module} |`,
    `| Pattern drift issues | ${report.summary.skills_with_pattern_drift} |`,
    `| Rule drift issues | ${report.summary.skills_with_rule_drift} |`,
    `| Unmapped legacy patterns | ${report.summary.unmapped_legacy_patterns.length} |`,
    '',
  ];

  if (report.summary.unmapped_legacy_patterns.length > 0) {
    lines.push('### Unmapped legacy patterns', '');
    for (const patternId of report.summary.unmapped_legacy_patterns) {
      lines.push(`- \`${patternId}\``);
    }
    lines.push('');
  }

  if (report.issues.length > 0) {
    lines.push('## Drift Issues (sample)', '');
    for (const issue of report.issues.slice(0, 25)) {
      lines.push(`- \`${issue.skill_id}\` [${issue.code}]: ${issue.message}`);
    }
    if (report.issues.length > 25) {
      lines.push(`- … and ${report.issues.length - 25} more`);
    }
  } else {
    lines.push('No drift issues detected.', '');
  }

  return lines.join('\n');
}

export type { SkillCorpusEntry };
