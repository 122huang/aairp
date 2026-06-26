import type { FastifyInstance } from 'fastify';
import type { FeedbackAdminService } from '@aairp/application';
import { AppError, FeedbackValidationError } from '@aairp/shared-kernel';
import { toPaginatedResponseDto } from '../dto/kos-pagination.dto.js';
import { toFeedbackDto } from '../dto/feedback.dto.js';
import { sendJson } from '../middleware/http.js';
import {
  parseCreateFeedbackBody,
  parseFeedbackSearchQuery,
  parseKosActorHeaders,
  parseUpdateFeedbackBody,
} from '../validation/feedback-request.js';

export type FeedbackControllerDeps = {
  feedbackAdminService: FeedbackAdminService;
};

function mapServiceError(error: unknown): never {
  if (error instanceof FeedbackValidationError) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', error.message, {
      issues: error.issues,
    });
  }
  throw error;
}

function adminCtx(request: { headers: Record<string, unknown>; traceId: string }) {
  const headers = parseKosActorHeaders(request.headers);
  return {
    actor: headers.actor,
    traceId: request.traceId ?? headers.traceId,
  };
}

export async function registerFeedbackController(
  app: FastifyInstance,
  deps: FeedbackControllerDeps,
): Promise<void> {
  app.get('/feedback', async (request, reply) => {
    const filters = parseFeedbackSearchQuery(request.query as Record<string, unknown>);
    const result = await deps.feedbackAdminService.search(filters);
    sendJson(
      reply,
      200,
      toPaginatedResponseDto({
        items: result.items.map(toFeedbackDto),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      }),
    );
  });

  app.post('/feedback', async (request, reply) => {
    const body = parseCreateFeedbackBody(request.body);
    try {
      const record = await deps.feedbackAdminService.createFeedback(
        {
          reviewId: body.review_id,
          caseId: body.case_id,
          pilotId: body.pilot_id,
          decision: body.decision,
          ratings: body.ratings,
          comment: body.comment,
          reviewerId: body.reviewer_id,
          metadata: body.metadata,
        },
        adminCtx(request),
      );
      sendJson(reply, 201, toFeedbackDto(record));
    } catch (error) {
      mapServiceError(error);
    }
  });

  app.get<{ Params: { feedbackId: string } }>(
    '/feedback/:feedbackId',
    async (request, reply) => {
      const record = await deps.feedbackAdminService.getFeedback(request.params.feedbackId);
      if (!record) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `feedback not found: ${request.params.feedbackId}`,
        );
      }
      sendJson(reply, 200, toFeedbackDto(record));
    },
  );

  app.patch<{ Params: { feedbackId: string } }>(
    '/feedback/:feedbackId',
    async (request, reply) => {
      const existing = await deps.feedbackAdminService.getFeedback(request.params.feedbackId);
      if (!existing) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `feedback not found: ${request.params.feedbackId}`,
        );
      }
      const body = parseUpdateFeedbackBody(request.body);
      try {
        const updated = await deps.feedbackAdminService.updateFeedback(
          {
            feedbackId: request.params.feedbackId,
            status: body.status,
            decision: body.decision,
            comment: body.comment,
            ratings: body.ratings,
            metadata: body.metadata,
          },
          adminCtx(request),
        );
        sendJson(reply, 200, toFeedbackDto(updated));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );
}
