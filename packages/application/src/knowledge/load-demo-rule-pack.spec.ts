import { describe, expect, it } from 'vitest';
import { DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import { loadDemoRulePackSync } from './load-demo-rule-pack.js';

describe('loadDemoRulePackSync', () => {
  it('loads demo/rules.demo.json with normalized citations', () => {
    const pack = loadDemoRulePackSync();

    expect(pack.pack_version).toBe(DEMO_KNOWLEDGE_VERSIONS.rulePackVersion);
    expect(pack.rules.length).toBeGreaterThanOrEqual(18);

    const healthBlocker = pack.rules.find((r) => r.rule_id === 'demo-apac-sa-health-claim-blocker');
    // Citation pass 1: multi-market health-claim hygiene (not Demo placeholder).
    expect(healthBlocker?.citation?.lawName).toMatch(/CPFTA|SCAP|广告法/);
    expect(healthBlocker?.citation?.lawName).not.toMatch(/\(Demo\)/);
    expect(healthBlocker?.forbidden_terms).toContain('easy to digest');
  });
});
