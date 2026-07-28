import type { FastifyInstance } from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import {
  AdvertisementUploadValidationError,
  ReviewHappyPathService,
  CaseRecorderService,
  entryModeTag,
} from '@aairp/application';
import { extractEntryMode, extractParentCaseId, toDemoReviewResponseDto } from '../dto/demo-review.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';
import { logReviewPipelineTimings } from '../middleware/review-logging.js';

export type DemoReviewControllerDeps = {
  reviewHappyPathService: ReviewHappyPathService;
  caseRecorderService?: CaseRecorderService;
};

function withEntryModeTag(body: unknown, entryMode: 'single' | 'batch' | 'image' | undefined): unknown {
  if (!entryMode || !body || typeof body !== 'object' || Array.isArray(body)) {
    return body;
  }
  const record = body as { tags?: unknown };
  const existing = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  const tag = entryModeTag(entryMode);
  if (existing.includes(tag)) {
    return body;
  }
  return {
    ...record,
    tags: [...existing.filter((item) => !item.startsWith('entry_mode:')), tag],
  };
}

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
        const parentCaseId = extractParentCaseId(request.body);
        const entryMode = extractEntryMode(request.body);
        if (entryMode === 'image') {
          const images = (
            request.body as { content?: { images?: unknown } } | null
          )?.content?.images;
          const hasImage =
            Array.isArray(images) &&
            images.some((item) => typeof item === 'string' && item.trim().length > 0);
          if (!hasImage) {
            throw new AppError(
              'INVALID_REQUEST',
              400,
              'Bad Request',
              'entry_mode=image requires at least one image in content.images',
            );
          }
        }
        const result = await deps.reviewHappyPathService.run(
          withEntryModeTag(request.body, entryMode),
        );

        let caseRecord = null;
        if (deps.caseRecorderService) {
          try {
            caseRecord = await deps.caseRecorderService.record(result, {
              ...(parentCaseId ? { parent_case_id: parentCaseId } : {}),
            });
          } catch (error) {
            request.log.warn(
              {
                trace_id: request.traceId,
                review_id: result.reviewId,
                error: error instanceof Error ? error.message : String(error),
              },
              'case library save failed after review',
            );
          }
        }

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
            ...(caseRecord
              ? {
                  case_id: caseRecord.case_id,
                  thread_id: caseRecord.thread_id,
                  parent_case_id: caseRecord.parent_case_id,
                }
              : {}),
          },
          result.timings,
          'happy path review completed',
        );

        sendJson(reply, 200, toDemoReviewResponseDto(result, caseRecord));
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
