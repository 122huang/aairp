import type { FastifyBaseLogger } from 'fastify';
import type { ReviewPipelineTimings } from '@aairp/shared-kernel';

export function logReviewPipelineTimings(
  log: FastifyBaseLogger,
  meta: Record<string, unknown>,
  timings: ReviewPipelineTimings,
  message: string,
): void {
  log.info(
    {
      ...meta,
      duration_ms: timings.totalMs,
      stage_ms: {
        rule: timings.ruleMs,
        playbook: timings.playbookMs,
        open_risk: timings.openRiskMs,
        vision: timings.visionMs,
        decision: timings.decisionMs,
        report: timings.reportMs,
      },
    },
    message,
  );
}
