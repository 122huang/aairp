import type { OpenRiskDiscoveryResult } from '../findings/llm-finding.js';
import type { PlaybookEvaluationResult } from '../findings/playbook-finding.js';
import type { VisionDiscoveryResult } from '../findings/vision-finding.js';
import type { ReviewContext } from '../context/review-context.js';
import type { RuleEvaluationResult } from '../findings/rule-finding.js';

/** Read-only pipeline outputs used for Case Library persistence (no re-evaluation). */
export type ReviewCaseSnapshot = {
  context: ReviewContext;
  ruleResult: RuleEvaluationResult;
  playbookResult: PlaybookEvaluationResult;
  openRiskResult: OpenRiskDiscoveryResult;
  visionResult?: VisionDiscoveryResult;
};
