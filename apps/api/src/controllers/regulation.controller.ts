import type { FastifyInstance } from 'fastify';
import type { RegulationAdminService } from '@aairp/application';
import { AppError, KosPublishError } from '@aairp/shared-kernel';
import {
  toRegulationDto,
  toRegulationExportDto,
  toRegulationVersionDto,
} from '../dto/regulation.dto.js';
import { toPaginatedResponseDto } from '../dto/kos-pagination.dto.js';
import { sendJson } from '../middleware/http.js';
import {
  parseCreateRegulationBody,
  parseCreateRegulationVersionBody,
  parseKosActorHeaders,
  parseRegulationListQuery,
  parseUpdateRegulationVersionBody,
} from '../validation/regulation-request.js';

export type RegulationControllerDeps = {
  regulationAdminService: RegulationAdminService;
};

function mapServiceError(error: unknown): never {
  if (error instanceof KosPublishError) {
    throw new AppError(
      error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'CONFLICT',
      error.code === 'NOT_FOUND' ? 404 : 409,
      error.code === 'NOT_FOUND' ? 'Not Found' : 'Conflict',
      error.message,
    );
  }
  if (error instanceof Error && error.message.includes('only DRAFT')) {
    throw new AppError('CONFLICT', 409, 'Conflict', error.message);
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

export async function registerRegulationController(
  app: FastifyInstance,
  deps: RegulationControllerDeps,
): Promise<void> {
  app.get('/regulations', async (request, reply) => {
    const query = parseRegulationListQuery(request.query as Record<string, unknown>);
    const result = await deps.regulationAdminService.listRegulations(query);
    sendJson(
      reply,
      200,
      toPaginatedResponseDto(
        {
          items: result.items.map(toRegulationDto),
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
        query.q,
      ),
    );
  });

  app.post('/regulations', async (request, reply) => {
    const body = parseCreateRegulationBody(request.body);
    const regulation = await deps.regulationAdminService.createRegulation(
      {
        regulationKey: body.regulation_key,
        jurisdiction: body.jurisdiction,
      },
      adminCtx(request),
    );
    sendJson(reply, 201, toRegulationDto(regulation));
  });

  app.get<{ Params: { regulationId: string } }>(
    '/regulations/:regulationId',
    async (request, reply) => {
      const regulation = await deps.regulationAdminService.getRegulation(
        request.params.regulationId,
      );
      if (!regulation) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `regulation not found: ${request.params.regulationId}`,
        );
      }
      sendJson(reply, 200, toRegulationDto(regulation));
    },
  );

  app.get<{ Params: { regulationId: string } }>(
    '/regulations/:regulationId/versions',
    async (request, reply) => {
      const regulation = await deps.regulationAdminService.getRegulation(
        request.params.regulationId,
      );
      if (!regulation) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `regulation not found: ${request.params.regulationId}`,
        );
      }
      const versions = await deps.regulationAdminService.listVersions(
        request.params.regulationId,
      );
      sendJson(reply, 200, { versions: versions.map(toRegulationVersionDto) });
    },
  );

  app.post<{ Params: { regulationId: string } }>(
    '/regulations/:regulationId/versions',
    async (request, reply) => {
      const regulation = await deps.regulationAdminService.getRegulation(
        request.params.regulationId,
      );
      if (!regulation) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `regulation not found: ${request.params.regulationId}`,
        );
      }
      const body = parseCreateRegulationVersionBody(request.body);
      const version = await deps.regulationAdminService.createVersion(
        {
          regulationId: request.params.regulationId,
          lawName: body.law_name,
          article: body.article,
          sourceUrl: body.source_url,
          bodyText: body.body_text,
          tags: body.tags,
          searchText: body.search_text,
          effectiveDate: body.effective_date,
          mandatory: body.mandatory,
          riskLevel: body.risk_level,
        },
        adminCtx(request),
      );
      sendJson(reply, 201, toRegulationVersionDto(version));
    },
  );

  app.get<{ Params: { regulationId: string; versionId: string } }>(
    '/regulations/:regulationId/versions/:versionId',
    async (request, reply) => {
      const version = await deps.regulationAdminService.getVersion(request.params.versionId);
      if (!version || version.regulationId !== request.params.regulationId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `regulation version not found: ${request.params.versionId}`,
        );
      }
      sendJson(reply, 200, toRegulationVersionDto(version));
    },
  );

  app.patch<{ Params: { regulationId: string; versionId: string } }>(
    '/regulations/:regulationId/versions/:versionId',
    async (request, reply) => {
      const version = await deps.regulationAdminService.getVersion(request.params.versionId);
      if (!version || version.regulationId !== request.params.regulationId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `regulation version not found: ${request.params.versionId}`,
        );
      }
      const body = parseUpdateRegulationVersionBody(request.body);
      try {
        const updated = await deps.regulationAdminService.updateVersion(
          request.params.versionId,
          {
            lawName: body.law_name,
            article: body.article,
            sourceUrl: body.source_url,
            bodyText: body.body_text,
            tags: body.tags,
            searchText: body.search_text,
            effectiveDate: body.effective_date,
            mandatory: body.mandatory,
            riskLevel: body.risk_level,
          },
          adminCtx(request),
        );
        sendJson(reply, 200, toRegulationVersionDto(updated));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.post<{ Params: { regulationId: string; versionId: string } }>(
    '/regulations/:regulationId/versions/:versionId/publish',
    async (request, reply) => {
      const version = await deps.regulationAdminService.getVersion(request.params.versionId);
      if (!version || version.regulationId !== request.params.regulationId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `regulation version not found: ${request.params.versionId}`,
        );
      }
      try {
        const published = await deps.regulationAdminService.publishVersion(
          request.params.versionId,
          adminCtx(request),
        );
        sendJson(reply, 200, toRegulationVersionDto(published));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.post<{ Params: { regulationId: string; versionId: string } }>(
    '/regulations/:regulationId/versions/:versionId/rollback',
    async (request, reply) => {
      const version = await deps.regulationAdminService.getVersion(request.params.versionId);
      if (!version || version.regulationId !== request.params.regulationId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `regulation version not found: ${request.params.versionId}`,
        );
      }
      try {
        const rolledBack = await deps.regulationAdminService.rollbackVersion(
          request.params.versionId,
          adminCtx(request),
        );
        sendJson(reply, 200, toRegulationVersionDto(rolledBack));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.get<{ Params: { regulationId: string } }>(
    '/regulations/:regulationId/export',
    async (request, reply) => {
      const bundle = await deps.regulationAdminService.exportBundle(
        request.params.regulationId,
      );
      if (!bundle) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `regulation not found: ${request.params.regulationId}`,
        );
      }
      reply.header('content-type', 'application/json; charset=utf-8');
      reply.header(
        'content-disposition',
        `attachment; filename="regulation-${bundle.regulation_key}-export.json"`,
      );
      reply.send(toRegulationExportDto(bundle));
    },
  );
}
