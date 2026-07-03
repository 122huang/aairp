import { describe, expect, it } from 'vitest';
import { resolveRegulationOwnershipLifecycle, resolveRuleOwnershipLifecycle } from './kos-ownership-lifecycle.js';

describe('KOS ownership lifecycle (P2)', () => {
  it('maps health rules to Claim Review module owner', () => {
    const lifecycle = resolveRuleOwnershipLifecycle('demo-sg-health-forbidden-claim');
    expect(lifecycle.owner).toBe('legal-apac@aairp');
    expect(lifecycle.owner_type).toBe('legal');
    expect(lifecycle.freshness_status).toBeTruthy();
  });

  it('maps regulations by jurisdiction key prefix', () => {
    const sg = resolveRegulationOwnershipLifecycle('sg-hpa-s7');
    expect(sg.owner_type).toBe('legal');
    const other = resolveRegulationOwnershipLifecycle('apac-general');
    expect(other.owner_type).toBe('compliance');
  });
});
