import type { CaseLifecycleStatus } from '../case/case-record.js';
import type { FinalDecision } from '../decision/review-decision.js';
import type { ModuleFinding } from './finding-types.js';

export type CaseFindingDecision = 'WARN' | 'PASS';

export type CaseEvaluationDetail = {
  similarityScore: number;
  precedentFinalDecision: FinalDecision;
  lifecycleStatus: CaseLifecycleStatus;
  precedentCaseIds: string[];
  ruleOverlap?: string[];
};

export type CaseFinding = ModuleFinding & {
  module: 'CASE';
  refType: 'CASE_PRECEDENT';
  decision: CaseFindingDecision;
  evaluationDetail: CaseEvaluationDetail;
};

export type CaseEvaluationResult = {
  reviewId: string;
  findings: CaseFinding[];
  evaluatedAt: string;
};
