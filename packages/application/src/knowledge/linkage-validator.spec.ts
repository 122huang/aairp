import { describe, expect, it } from 'vitest';
import { validateKnowledgeLinkage } from './linkage-validator.js';
import { buildKnowledgeCoverageReport } from './knowledge-coverage.js';

describe('Knowledge Linkage Validator (E4)', () => {
  it('has no L7 rule-playbook term sync errors on the demo pack', () => {
    const result = validateKnowledgeLinkage({ strict: false });
    const l7Errors = result.issues.filter((issue) => issue.rule_id === 'L7');
    expect(l7Errors).toEqual([]);
  });

  it('reports L7b/L7c warnings when playbook and rule keywords drift', () => {
    const result = validateKnowledgeLinkage({ strict: false });
    const termSyncWarnings = result.issues.filter((issue) =>
      issue.rule_id.startsWith('L7'),
    );
    expect(termSyncWarnings.length).toBeGreaterThan(0);
    expect(termSyncWarnings.every((issue) => issue.severity === 'warn')).toBe(true);
  });

  it('passes non-strict linkage with locale-expansion benchmark coverage for ID/VN/PH rules', () => {
    const result = validateKnowledgeLinkage({ strict: false });
    expect(result.passed).toBe(true);
    expect(result.error_count).toBe(0);

    const localeExpansionRules = [
      'demo-id-sponsored-disclosure',
      'demo-id-product-category-boundary',
      'demo-id-sa-market-claim',
      'demo-vn-sa-market-claim',
      'demo-vn-foreign-brand-ad-approval',
      'demo-ph-sponsored-disclosure',
      'demo-ph-sa-market-claim',
    ];
    for (const ruleId of localeExpansionRules) {
      expect(result.orphans.rules_without_benchmark).not.toContain(ruleId);
    }

    const legacyPatterns = [
      'sa-medical-claim',
      'sa-competitor-trademark',
      'sg-local-market-claim',
    ];
    for (const patternId of legacyPatterns) {
      const issue = result.issues.find((item) => item.object_id === patternId);
      expect(issue?.rule_id).toBe('L1-legacy');
      expect(issue?.severity).toBe('warn');
    }

    const l7Warnings = result.issues.filter(
      (issue) => issue.rule_id === 'L7b' || issue.rule_id === 'L7c',
    );
    // B3 oil-trigger tighten adds one more rule↔playbook keyword drift warning vs the prior baseline of 10.
    expect(l7Warnings.length).toBe(11);
    expect(result.warn_count).toBeGreaterThan(0);
  });
});

describe('Knowledge Coverage Report (E5)', () => {
  it('includes inventory counts and coverage percentages', () => {
    const report = buildKnowledgeCoverageReport();
    expect(report.inventory.rules).toBeGreaterThan(0);
    expect(report.inventory.skill_patterns).toBeGreaterThanOrEqual(13);
    expect(report.inventory.benchmark_cases).toBeGreaterThanOrEqual(84);
    expect(report.coverage.golden_issues_mapped_pct).toBe(100);
    expect(report.coverage.playbook_patterns_with_skill_module_pct).toBe(100);
    expect(typeof report.coverage.patterns_with_benchmark_pct).toBe('number');
  });
});
