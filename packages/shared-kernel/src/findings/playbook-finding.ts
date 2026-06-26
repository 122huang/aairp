import type { ModuleFinding } from './finding-types.js';

export type PlaybookDecision = 'WARN' | 'REVIEW' | 'CONDITIONAL';

export type PlaybookSeverityHint = 'HIGH' | 'MEDIUM' | 'LOW';

export type PlaybookTypicalDecision = 'REJECT' | 'REVIEW' | 'CONDITIONAL_PASS';

export type PlaybookEvaluationDetail = {
  patternId: string;
  checklistIds: string[];
  guidance: string;
  severityHint: PlaybookSeverityHint;
  playbookDecision: PlaybookDecision;
  typicalDecision: PlaybookTypicalDecision;
  matchedSpans?: Array<{
    field: string;
    start: number;
    end: number;
    text: string;
  }>;
  casePrecedentHint?: string;
};

export type PlaybookFinding = ModuleFinding & {
  module: 'PLAYBOOK';
  refType: 'PLAYBOOK_PATTERN';
  decision: PlaybookDecision;
  evaluationDetail?: PlaybookEvaluationDetail;
};

export type PlaybookEvaluationResult = {
  reviewId: string;
  playbookPackVersion: string;
  findings: PlaybookFinding[];
  evaluatedAt: string;
};
