import type { FreshnessStatus, OwnerType } from './ownership.js';
import { loadSkillModules } from './skill-modules.js';

export type KosOwnershipLifecycle = {
  owner: string;
  owner_type: OwnerType;
  last_reviewed_at: string;
  freshness_status: FreshnessStatus;
};

const DEFAULT_OWNER = 'legal-apac@aairp';

export function resolveRuleOwnershipLifecycle(ruleKey: string): KosOwnershipLifecycle {
  const modules = loadSkillModules();
  for (const mod of modules.modules) {
    if (mod.applicable_rules?.includes(ruleKey)) {
      return {
        owner: mod.owner ?? DEFAULT_OWNER,
        owner_type: mod.owner_type,
        last_reviewed_at: mod.last_reviewed_at,
        freshness_status: mod.freshness_status,
      };
    }
  }
  return {
    owner: DEFAULT_OWNER,
    owner_type: 'legal',
    last_reviewed_at: '2026-06-15T00:00:00.000Z',
    freshness_status: 'current',
  };
}

export function resolveRegulationOwnershipLifecycle(regulationKey: string): KosOwnershipLifecycle {
  if (regulationKey.startsWith('sg-')) {
    return {
      owner: 'legal-apac@aairp',
      owner_type: 'legal',
      last_reviewed_at: '2026-06-15T00:00:00.000Z',
      freshness_status: 'current',
    };
  }
  return {
    owner: 'compliance-apac@aairp',
    owner_type: 'compliance',
    last_reviewed_at: '2026-06-15T00:00:00.000Z',
    freshness_status: 'review_due',
  };
}
