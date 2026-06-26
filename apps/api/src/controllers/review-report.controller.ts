import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import {
  AdvertisementNotFoundError,
  ContextBuilderService,
  ReviewPipelineService,
} from '@aairp/application';
import { toReviewReportResponseDto } from '../dto/review-report.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';
import { logReviewPipelineTimings } from '../middleware/review-logging.js';
import { parseAdvertisementIdRequest } from '../validation/demo-request.js';

export type ReviewReportControllerDeps = {
  contextBuilderService: ContextBuilderService;
  reviewPipelineService: ReviewPipelineService;
};

export async function registerReviewReportController(
  app: FastifyInstance,
  deps: ReviewReportControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.post(
    '/demo/review-report',
    { preHandler: probePreHandler },
    async (request, reply) => {
      const payload = parseAdvertisementIdRequest(request.body);

      try {
        const context = await deps.contextBuilderService.buildFromAdvertisementId(
          payload.advertisement_id,
        );
        const pipeline = await deps.reviewPipelineService.runThroughReport(context);

        logReviewPipelineTimings(
          request.log,
          {
            trace_id: request.traceId,
            review_id: pipeline.report.reviewId,
            advertisement_id: payload.advertisement_id,
            final_decision: pipeline.report.summary.finalDecision,
            finding_count: pipeline.report.summary.findings.length,
            open_risk_skipped: pipeline.report.summary.openRiskSkipped,
          },
          pipeline.timings,
          'review report generated',
        );

        sendJson(reply, 200, toReviewReportResponseDto(pipeline.report));
      } catch (error) {
        if (error instanceof AdvertisementNotFoundError) {
          request.log.warn(
            {
              trace_id: request.traceId,
              advertisement_id: error.advertisementId,
            },
            'review report generation failed: advertisement not found',
          );
          throw new AppError(
            'INVALID_REQUEST',
            400,
            'Bad Request',
            error.message,
          );
        }
        throw error;
      }
    },
  );
}
