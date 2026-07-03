import { skillCorpusPlugin } from './corpus/skill-corpus.plugin.js';
import type { ValidationIssue, ValidationResult } from './platform/governance/validator.js';

export type SkillValidationIssue = {
  severity: 'error' | 'warn';
  code: string;
  skill_id: string;
  message: string;
};

export type SkillValidationResult = {
  validated_at: string;
  entry_count: number;
  passed: boolean;
  error_count: number;
  warn_count: number;
  issues: SkillValidationIssue[];
  governance_warnings: SkillValidationIssue[];
};

function mapIssue(issue: ValidationIssue): SkillValidationIssue {
  return {
    severity: issue.severity,
    code: issue.code,
    skill_id: issue.entry_key,
    message: issue.message,
  };
}

function mapResult(result: ValidationResult): SkillValidationResult {
  return {
    validated_at: result.validated_at,
    entry_count: result.entry_count,
    passed: result.passed,
    error_count: result.error_count,
    warn_count: result.warn_count,
    issues: result.issues.map(mapIssue),
    governance_warnings: result.governance_warnings.map(mapIssue),
  };
}

export function validateSkillCorpus(options?: {
  customRoot?: string;
  now?: Date;
}): SkillValidationResult {
  const now = options?.now ?? new Date();
  const bundle = skillCorpusPlugin.load(options?.customRoot);
  const result = skillCorpusPlugin.validate(bundle.entries, {
    now,
    knownRuleIds: skillCorpusPlugin.knownRuleIds?.(),
  });
  return mapResult(result);
}
