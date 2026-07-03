export type DemoRuleEntry = {
  rule_id: string;
  severity: string;
  forbidden_terms?: string[];
  trigger_terms?: string[];
  required_any_terms?: string[];
  sku_mismatch_check?: boolean;
};

export type RulePlaybookTermSyncIssue = {
  code: 'L7' | 'L7b' | 'L7c';
  pattern_id: string;
  rule_id: string;
  message: string;
};

const MAX_TERMS_IN_MESSAGE = 5;

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

export function extractRuleKeywordTerms(rule: DemoRuleEntry): string[] {
  const terms = [...(rule.forbidden_terms ?? []), ...(rule.trigger_terms ?? [])];
  return [...new Set(terms.map(normalizeTerm).filter((term) => term.length > 0))];
}

export function isKeywordRule(rule: DemoRuleEntry): boolean {
  return extractRuleKeywordTerms(rule).length > 0;
}

function formatTermSample(terms: string[]): string {
  const sample = terms.slice(0, MAX_TERMS_IN_MESSAGE);
  const suffix = terms.length > MAX_TERMS_IN_MESSAGE ? ` (+${terms.length - MAX_TERMS_IN_MESSAGE} more)` : '';
  return `${sample.join(', ')}${suffix}`;
}

export function buildPatternRuleLinks(
  patternIds: string[],
  explicitLinks: Record<string, string[]>,
  goldenLinks: Array<{ pattern_id: string | null; expected_rule: string | null }>,
  benchmarkLinks: Array<{ pattern_id: string | null; expected_rule: string | null }>,
): Map<string, string[]> {
  const links = new Map<string, string[]>();

  const addLink = (patternId: string, ruleId: string) => {
    const existing = links.get(patternId) ?? [];
    if (!existing.includes(ruleId)) {
      links.set(patternId, [...existing, ruleId]);
    }
  };

  for (const patternId of patternIds) {
    for (const ruleId of explicitLinks[patternId] ?? []) {
      addLink(patternId, ruleId);
    }
  }

  for (const entry of [...goldenLinks, ...benchmarkLinks]) {
    if (entry.pattern_id && entry.expected_rule) {
      addLink(entry.pattern_id, entry.expected_rule);
    }
  }

  return links;
}

export type PlaybookItemForTermSync = {
  patternId: string;
  triggerKeywords: string[];
};

export function validateRulePlaybookTermSync(input: {
  playbook: { items: PlaybookItemForTermSync[] };
  rules: DemoRuleEntry[];
  patternRuleLinks: Map<string, string[]>;
  /** For WARN-tier rules, flag drift when overlap ratio falls below this (0–1). */
  minWarnRuleCoverageRatio?: number;
}): RulePlaybookTermSyncIssue[] {
  const minWarnRuleCoverageRatio = input.minWarnRuleCoverageRatio ?? 0.5;
  const rulesById = new Map(input.rules.map((rule) => [rule.rule_id, rule]));
  const issues: RulePlaybookTermSyncIssue[] = [];

  for (const item of input.playbook.items) {
    const linkedRuleIds = input.patternRuleLinks.get(item.patternId) ?? [];
    if (linkedRuleIds.length === 0) {
      continue;
    }

    const linkedRules = linkedRuleIds
      .map((ruleId) => rulesById.get(ruleId))
      .filter((rule): rule is DemoRuleEntry => Boolean(rule && isKeywordRule(rule)));

    if (linkedRules.length === 0) {
      continue;
    }

    const playbookTerms = [...new Set(item.triggerKeywords.map(normalizeTerm).filter(Boolean))];
    const playbookSet = new Set(playbookTerms);
    const ruleTermUnion = new Set<string>();

    for (const rule of linkedRules) {
      for (const term of extractRuleKeywordTerms(rule)) {
        ruleTermUnion.add(term);
      }
    }

    const overlap = playbookTerms.filter((term) => ruleTermUnion.has(term));
    const linkedRuleLabel = linkedRules.map((rule) => rule.rule_id).join(', ');

    if (overlap.length === 0) {
      issues.push({
        code: 'L7',
        pattern_id: item.patternId,
        rule_id: linkedRuleLabel,
        message: `Zero keyword overlap between playbook triggers and linked rule terms (${linkedRuleLabel})`,
      });
      continue;
    }

    const playbookOnly = playbookTerms.filter((term) => !ruleTermUnion.has(term));
    if (playbookOnly.length > 0) {
      issues.push({
        code: 'L7b',
        pattern_id: item.patternId,
        rule_id: linkedRuleLabel,
        message: `Playbook triggers not present in any linked rule: ${formatTermSample(playbookOnly)}`,
      });
    }

    for (const rule of linkedRules) {
      if (rule.severity === 'BLOCKER') {
        continue;
      }

      const ruleTerms = extractRuleKeywordTerms(rule);
      const ruleOnly = ruleTerms.filter((term) => !playbookSet.has(term));
      const coverage =
        ruleTerms.length === 0 ? 1 : (ruleTerms.length - ruleOnly.length) / ruleTerms.length;
      if (ruleOnly.length > 0 && coverage < minWarnRuleCoverageRatio) {
        issues.push({
          code: 'L7c',
          pattern_id: item.patternId,
          rule_id: rule.rule_id,
          message: `Rule terms missing from playbook (${Math.round(coverage * 100)}% covered): ${formatTermSample(ruleOnly)}`,
        });
      }
    }
  }

  return issues;
}
