export type FindingModule = 'RULE' | 'POLICY' | 'PLAYBOOK' | 'CASE' | 'LLM';

export type FindingSeverity = 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'LOW';

export type FindingDecision = 'FAIL' | 'WARN' | 'PASS' | 'REVIEW' | 'CONDITIONAL';

export type MatchedSpan = {
  field: string;
  start: number;
  end: number;
  text: string;
};

export type FindingCitation = {
  lawName: string;
  article?: string;
  url?: string;
};

export type ModuleFinding = {
  module: FindingModule;
  findingId: string;
  severity: FindingSeverity;
  decision: FindingDecision;
  refType: string;
  refId: string;
  refVersionId: string;
  summary: string;
  confidence: number;
  evaluationDetail?: {
    matchedSpans?: MatchedSpan[];
    citation?: FindingCitation;
  };
};
