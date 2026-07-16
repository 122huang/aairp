import { describe, expect, it } from 'vitest';
import { DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import { loadDemoRulePackSync } from './load-demo-rule-pack.js';

describe('loadDemoRulePackSync', () => {
  it('loads demo/rules.demo.json with normalized citations', () => {
    const pack = loadDemoRulePackSync();

    expect(pack.pack_version).toBe(DEMO_KNOWLEDGE_VERSIONS.rulePackVersion);
    expect(pack.rules.length).toBeGreaterThanOrEqual(18);

    const healthBlocker = pack.rules.find((r) => r.rule_id === 'demo-apac-sa-health-claim-blocker');
    // Citation was upgraded from the "APAC Advertising Standards (Demo)" placeholder to real
    // multi-market law references (see demo/rules.demo.json article note).
    expect(healthBlocker?.citation?.lawName).toContain('Consumer Protection');
    expect(healthBlocker?.citation?.lawName).not.toContain('APAC Advertising Standards (Demo)');
    expect(healthBlocker?.forbidden_terms).toContain('easy to digest');
  });
});
