import type { FastifyInstance } from 'fastify';
import type { CaseKosAdminService } from '@aairp/application';
import { AppError } from '@aairp/shared-kernel';
import { toPaginatedResponseDto } from '../dto/kos-pagination.dto.js';
import { toCaseManifestDto } from '../dto/case.dto.js';
import { sendJson } from '../middleware/http.js';
import {
  parseCaseRollbackBody,
  parseCaseSearchQuery,
  parseKosActorHeaders,
} from '../validation/case-request.js';

export type CaseControllerDeps = {
  caseKosAdminService: CaseKosAdminService;
};

function adminCtx(request: { headers: Record<string, unknown>; traceId: string }) {
  const headers = parseKosActorHeaders(request.headers);
  return {
    actor: headers.actor,
    traceId: request.traceId ?? headers.traceId,
  };
}

export async function registerCaseController(
  app: FastifyInstance,
  deps: CaseControllerDeps,
): Promise<void> {
  app.get('/cases', async (request, reply) => {
    const filters = parseCaseSearchQuery(request.query as Record<string, unknown>);
    const result = await deps.caseKosAdminService.search(filters);
    sendJson(
      reply,
      200,
      toPaginatedResponseDto({
        items: result.items.map(toCaseManifestDto),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      }),
    );
  });

  app.get('/cases/export', async (_request, reply) => {
    const cases = await deps.caseKosAdminService.exportAllLatest();
    const bundle = JSON.stringify(
      {
        schema_version: '1.0.0',
        exported_at: new Date().toISOString(),
        count: cases.length,
        cases,
      },
      null,
      2,
    );
    reply.header('content-type', 'application/json; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="case-library-export.json"');
    reply.send(bundle);
  });

  app.get<{ Params: { caseId: string } }>('/cases/:caseId', async (request, reply) => {
    const versionParam = (request.query as Record<string, unknown>).version;
    const caseVersion =
      typeof versionParam === 'string' && versionParam.length > 0
        ? Number(versionParam)
        : undefined;
    const record = await deps.caseKosAdminService.getCase(
      request.params.caseId,
      caseVersion,
    );
    if (!record) {
      throw new AppError('NOT_FOUND', 404, 'Not Found', `case not found: ${request.params.caseId}`);
    }
    sendJson(reply, 200, record);
  });

  app.get<{ Params: { caseId: string } }>(
    '/cases/:caseId/versions',
    async (request, reply) => {
      const record = await deps.caseKosAdminService.getCase(request.params.caseId);
      if (!record) {
        throw new AppError('NOT_FOUND', 404, 'Not Found', `case not found: ${request.params.caseId}`);
      }
      const versions = await deps.caseKosAdminService.listVersions(request.params.caseId);
      sendJson(reply, 200, { versions: versions.map(toCaseManifestDto) });
    },
  );

  app.post<{ Params: { caseId: string }; Body: Record<string, unknown> }>(
    '/cases/:caseId/confirm',
    async (request, reply) => {
      try {
        const body = (request.body ?? {}) as Record<string, unknown>;
        const feedback =
          body.human_feedback && typeof body.human_feedback === 'object'
            ? (body.human_feedback as {
                decision?: string;
                reviewer_id?: string;
                comment?: string;
                agreement_with_ai?: 'AGREE' | 'DISAGREE';
              })
            : undefined;
        const updated = await deps.caseKosAdminService.confirmCase(request.params.caseId, {
          ...adminCtx(request),
          ...(feedback
            ? {
                humanFeedback: {
                  decision: feedback.decision as
                    | 'PASS'
                    | 'WARN'
                    | 'REVIEW'
                    | 'REJECT'
                    | undefined,
                  reviewer_id: feedback.reviewer_id,
                  comment: feedback.comment,
                  agreement_with_ai: feedback.agreement_with_ai,
                },
              }
            : {}),
        });
        sendJson(reply, 200, updated);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('case not found')) {
          throw new AppError('NOT_FOUND', 404, 'Not Found', error.message);
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { caseId: string } }>(
    '/cases/:caseId/archive',
    async (request, reply) => {
      try {
        const updated = await deps.caseKosAdminService.archiveCase(
          request.params.caseId,
          adminCtx(request),
        );
        sendJson(reply, 200, updated);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('case not found')) {
          throw new AppError('NOT_FOUND', 404, 'Not Found', error.message);
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { caseId: string } }>(
    '/cases/:caseId/rollback',
    async (request, reply) => {
      const body = parseCaseRollbackBody(request.body);
      try {
        const restored = await deps.caseKosAdminService.rollbackCase(
          request.params.caseId,
          body.target_version,
          adminCtx(request),
        );
        sendJson(reply, 200, restored);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new AppError('NOT_FOUND', 404, 'Not Found', error.message);
        }
        throw error;
      }
    },
  );
}
