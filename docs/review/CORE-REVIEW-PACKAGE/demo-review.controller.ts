import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import {
  AdvertisementUploadValidationError,
  ReviewHappyPathService,
  CaseRecorderService,
} from '@aairp/application';
import { toDemoReviewResponseDto } from '../dto/demo-review.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';
import { logReviewPipelineTimings } from '../middleware/review-logging.js';

export type DemoReviewControllerDeps = {
  reviewHappyPathService: ReviewHappyPathService;
  caseRecorderService?: CaseRecorderService;
};

export async function registerDemoReviewController(
  app: FastifyInstance,
  deps: DemoReviewControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.post(
    '/demo/review',
    { preHandler: probePreHandler },
    async (request, reply) => {
      try {
        const result = await deps.reviewHappyPathService.run(request.body);

        deps.caseRecorderService?.recordSafely(result);

        logReviewPipelineTimings(
          request.log,
          {
            trace_id: request.traceId,
            review_id: result.reviewId,
            advertisement_id: result.advertisementId,
            final_decision: result.decision.finalDecision,
            confidence: result.decision.confidence,
            finding_count: result.report.summary.findings.length,
            open_risk_skipped: result.report.summary.openRiskSkipped,
          },
          result.timings,
          'happy path review completed',
        );

        sendJson(reply, 200, toDemoReviewResponseDto(result));
      } catch (error) {
        if (error instanceof AdvertisementUploadValidationError) {
          request.log.warn(
            {
              trace_id: request.traceId,
              errors: error.issues,
            },
            'happy path review validation failed',
          );
          throw new AppError(
            'INVALID_REQUEST',
            400,
            'Bad Request',
            error.message,
            { errors: error.issues },
          );
        }
        throw error;
      }
    },
  );
}
