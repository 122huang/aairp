export type FindingModule = 'RULE' | 'POLICY' | 'PLAYBOOK' | 'CASE' | 'LLM' | 'VISION';

export type FindingSeverity = 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Finding-level decision. INFO is display-only and must not participate in fusion. */
export type FindingDecision =
  | 'FAIL'
  | 'WARN'
  | 'PASS'
  | 'REVIEW'
  | 'CONDITIONAL'
  | 'INFO';

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
