import type { RemediationType } from '../knowledge/remediation-type.js';
import type { ModuleFinding } from './finding-types.js';

export type RuleFinding = ModuleFinding & {
  module: 'RULE';
  refType: 'RULE';
  remediationType?: RemediationType;
};

export type RuleEvaluationResult = {
  reviewId: string;
  rulePackVersion: string;
  findings: RuleFinding[];
  hasBlocker: boolean;
  evaluatedAt: string;
};
