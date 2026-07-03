import type { MatchedSpan } from './finding-types.js';

/** Verbatim trigger text grounded in ad copy or image evidence. */
export type RewriteOriginalSpan = MatchedSpan;

export type RewriteSuggestion = {
  suggestionId: string;
  /** Source finding that triggered this rewrite (e.g. rf_*, lf_*, vf_*). */
  findingId: string;
  /** Canonical open-risk / vision risk_type kebab-case id. */
  riskType: string;
  /** Resolved rewrite template from risk-rewrite-routes.json. */
  rewriteTemplateId: string;
  /** Trigger substring copied verbatim from the ad or evidence span. */
  originalSpan: RewriteOriginalSpan;
  /** One to three copy-ready rewrite drafts for reviewers. */
  suggestedText: string[];
  /** One-sentence explanation of why the rewrite addresses the finding. */
  rationale: string;
  confidence: number;
};

export type ContextualRewriteResult = {
  reviewId: string;
  findingId: string;
  riskType: string;
  suggestion?: RewriteSuggestion;
  skipped: boolean;
  skipReason?: 'BLOCKER_FINDING' | 'NO_WARN_ROUTE' | 'NO_ORIGINAL_SPAN' | 'REWRITE_MODE_OFF';
};

export type ContextualRewriteBatchResult = {
  mode: 'off' | 'stub' | 'live';
  results: ContextualRewriteResult[];
  rewriteMs: number;
};
