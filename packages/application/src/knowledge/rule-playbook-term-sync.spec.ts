import { describe, expect, it } from 'vitest';
import {
  buildPatternRuleLinks,
  extractRuleKeywordTerms,
  validateRulePlaybookTermSync,
} from './rule-playbook-term-sync.js';

describe('rule-playbook-term-sync', () => {
  it('flags zero overlap between playbook and linked rule terms (L7)', () => {
    const issues = validateRulePlaybookTermSync({
      playbook: {
        items: [{ patternId: 'sa-absolute-performance', triggerKeywords: ['零故障'] }],
      },
      rules: [
        {
          rule_id: 'demo-apac-sa-absolute-claim-soft',
          severity: 'MEDIUM',
          trigger_terms: ['every time', 'perfect'],
        },
      ],
      patternRuleLinks: new Map([
        ['sa-absolute-performance', ['demo-apac-sa-absolute-claim-soft']],
      ]),
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('L7');
  });

  it('passes when playbook and rule share at least one keyword', () => {
    const issues = validateRulePlaybookTermSync({
      playbook: {
        items: [{ patternId: 'sa-absolute-performance', triggerKeywords: ['零故障', 'perfect'] }],
      },
      rules: [
        {
          rule_id: 'demo-apac-sa-absolute-claim-soft',
          severity: 'MEDIUM',
          trigger_terms: ['零故障', 'every time'],
        },
      ],
      patternRuleLinks: new Map([
        ['sa-absolute-performance', ['demo-apac-sa-absolute-claim-soft']],
      ]),
    });

    expect(issues.filter((issue) => issue.code === 'L7')).toEqual([]);
  });

  it('warns when playbook triggers are not backed by any linked rule (L7b)', () => {
    const issues = validateRulePlaybookTermSync({
      playbook: {
        items: [
          {
            patternId: 'sa-health-implication',
            triggerKeywords: ['少油烹饪', 'not-in-rule'],
          },
        ],
      },
      rules: [
        {
          rule_id: 'demo-apac-sa-health-implication',
          severity: 'MEDIUM',
          trigger_terms: ['少油烹饪', '更清爽'],
        },
      ],
      patternRuleLinks: new Map([
        ['sa-health-implication', ['demo-apac-sa-health-implication']],
      ]),
    });

    expect(issues.some((issue) => issue.code === 'L7b')).toBe(true);
  });

  it('merges explicit, golden, and benchmark pattern-rule links', () => {
    const links = buildPatternRuleLinks(
      ['sa-medical-claim'],
      { 'sa-medical-claim': ['demo-apac-sa-health-claim-blocker'] },
      [{ pattern_id: 'sa-health-implication', expected_rule: 'demo-apac-sa-health-implication' }],
      [{ pattern_id: 'sa-absolute-performance', expected_rule: 'demo-apac-sa-absolute-claim' }],
    );

    expect(links.get('sa-medical-claim')).toEqual(['demo-apac-sa-health-claim-blocker']);
    expect(links.get('sa-absolute-performance')).toEqual(['demo-apac-sa-absolute-claim']);
    expect(links.get('sa-health-implication')).toEqual(['demo-apac-sa-health-implication']);
  });

  it('extracts forbidden and trigger terms from rules', () => {
    const terms = extractRuleKeywordTerms({
      rule_id: 'demo-apac-sa-health-claim-blocker',
      severity: 'BLOCKER',
      forbidden_terms: ['控糖', 'Detox'],
      trigger_terms: ['少油'],
    });

    expect(terms).toContain('控糖');
    expect(terms).toContain('detox');
    expect(terms).toContain('少油');
  });
});
