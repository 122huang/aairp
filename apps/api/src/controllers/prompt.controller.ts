import type { FastifyInstance } from 'fastify';
import type { PromptAdminService } from '@aairp/application';
import { AppError, KosPublishError, PromptValidationError } from '@aairp/shared-kernel';
import { toPaginatedResponseDto } from '../dto/kos-pagination.dto.js';
import {
  toPromptLintResultDto,
  toPromptPackDto,
  toPromptTemplateDto,
  toPromptVersionDto,
} from '../dto/prompt.dto.js';
import { sendJson } from '../middleware/http.js';
import {
  parseCreatePromptPackBody,
  parseCreatePromptTemplateBody,
  parseCreatePromptVersionBody,
  parseKosActorHeaders,
  parseLintPromptContentBody,
  parsePromptListQuery,
  parseUpdatePromptVersionBody,
} from '../validation/prompt-request.js';

export type PromptControllerDeps = {
  promptAdminService: PromptAdminService;
};

function mapServiceError(error: unknown): never {
  if (error instanceof PromptValidationError) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', error.message, {
      lint: toPromptLintResultDto(error.lint),
    });
  }
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

export async function registerPromptController(
  app: FastifyInstance,
  deps: PromptControllerDeps,
): Promise<void> {
  app.get('/prompt-packs', async (request, reply) => {
    const query = parsePromptListQuery(request.query as Record<string, unknown>);
    const result = await deps.promptAdminService.listPacks(query);
    sendJson(
      reply,
      200,
      toPaginatedResponseDto({
        items: result.items.map(toPromptPackDto),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      }),
    );
  });

  app.post('/prompt-packs', async (request, reply) => {
    const body = parseCreatePromptPackBody(request.body);
    const pack = await deps.promptAdminService.createPack(
      {
        packKey: body.pack_key,
        name: body.name,
        description: body.description,
      },
      adminCtx(request),
    );
    sendJson(reply, 201, toPromptPackDto(pack));
  });

  app.get<{ Params: { packId: string } }>('/prompt-packs/:packId', async (request, reply) => {
    const pack = await deps.promptAdminService.getPack(request.params.packId);
    if (!pack) {
      throw new AppError(
        'NOT_FOUND',
        404,
        'Not Found',
        `prompt pack not found: ${request.params.packId}`,
      );
    }
    sendJson(reply, 200, toPromptPackDto(pack));
  });

  app.get<{ Params: { packId: string } }>(
    '/prompt-packs/:packId/templates',
    async (request, reply) => {
      const pack = await deps.promptAdminService.getPack(request.params.packId);
      if (!pack) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt pack not found: ${request.params.packId}`,
        );
      }
      const query = parsePromptListQuery(request.query as Record<string, unknown>);
      const result = await deps.promptAdminService.listTemplates(request.params.packId, query);
      sendJson(
        reply,
        200,
        toPaginatedResponseDto({
          items: result.items.map(toPromptTemplateDto),
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        }),
      );
    },
  );

  app.post<{ Params: { packId: string } }>(
    '/prompt-packs/:packId/templates',
    async (request, reply) => {
      const pack = await deps.promptAdminService.getPack(request.params.packId);
      if (!pack) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt pack not found: ${request.params.packId}`,
        );
      }
      const body = parseCreatePromptTemplateBody(request.body);
      const template = await deps.promptAdminService.createTemplate(
        {
          promptPackId: request.params.packId,
          templateKey: body.template_key,
          templateType: body.template_type,
        },
        adminCtx(request),
      );
      sendJson(reply, 201, toPromptTemplateDto(template));
    },
  );

  app.post('/prompt-templates/lint', async (request, reply) => {
    const body = parseLintPromptContentBody(request.body);
    const lint = deps.promptAdminService.lintContent(body.content);
    sendJson(reply, 200, toPromptLintResultDto(lint));
  });

  app.get<{ Params: { templateId: string } }>(
    '/prompt-templates/:templateId',
    async (request, reply) => {
      const template = await deps.promptAdminService.getTemplate(request.params.templateId);
      if (!template) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt template not found: ${request.params.templateId}`,
        );
      }
      sendJson(reply, 200, toPromptTemplateDto(template));
    },
  );

  app.get<{ Params: { templateId: string } }>(
    '/prompt-templates/:templateId/versions',
    async (request, reply) => {
      const template = await deps.promptAdminService.getTemplate(request.params.templateId);
      if (!template) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt template not found: ${request.params.templateId}`,
        );
      }
      const status =
        typeof (request.query as Record<string, unknown>).status === 'string'
          ? ((request.query as Record<string, unknown>).status as
              | 'DRAFT'
              | 'PUBLISHED'
              | 'ARCHIVED')
          : undefined;
      const versions = await deps.promptAdminService.listVersions(
        request.params.templateId,
        status,
      );
      sendJson(reply, 200, { versions: versions.map((version) => toPromptVersionDto(version)) });
    },
  );

  app.post<{ Params: { templateId: string } }>(
    '/prompt-templates/:templateId/versions',
    async (request, reply) => {
      const template = await deps.promptAdminService.getTemplate(request.params.templateId);
      if (!template) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt template not found: ${request.params.templateId}`,
        );
      }
      const body = parseCreatePromptVersionBody(request.body);
      try {
        const version = await deps.promptAdminService.createVersion(
          {
            templateId: request.params.templateId,
            content: body.content,
            schemaVersion: body.schema_version,
            tags: body.tags,
          },
          adminCtx(request),
        );
        sendJson(reply, 201, toPromptVersionDto(version));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.get<{ Params: { templateId: string; versionId: string } }>(
    '/prompt-templates/:templateId/versions/:versionId',
    async (request, reply) => {
      const version = await deps.promptAdminService.getVersion(request.params.versionId);
      if (!version || version.templateId !== request.params.templateId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt version not found: ${request.params.versionId}`,
        );
      }
      sendJson(reply, 200, toPromptVersionDto(version));
    },
  );

  app.patch<{ Params: { templateId: string; versionId: string } }>(
    '/prompt-templates/:templateId/versions/:versionId',
    async (request, reply) => {
      const version = await deps.promptAdminService.getVersion(request.params.versionId);
      if (!version || version.templateId !== request.params.templateId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt version not found: ${request.params.versionId}`,
        );
      }
      const body = parseUpdatePromptVersionBody(request.body);
      try {
        const updated = await deps.promptAdminService.updateVersion(
          request.params.versionId,
          {
            content: body.content,
            schemaVersion: body.schema_version,
            tags: body.tags,
          },
          adminCtx(request),
        );
        sendJson(reply, 200, toPromptVersionDto(updated));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.get<{ Params: { templateId: string; versionId: string } }>(
    '/prompt-templates/:templateId/versions/:versionId/content',
    async (request, reply) => {
      const version = await deps.promptAdminService.getVersion(request.params.versionId);
      if (!version || version.templateId !== request.params.templateId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt version not found: ${request.params.versionId}`,
        );
      }
      reply.header('content-type', 'text/plain; charset=utf-8');
      reply.send(version.content);
    },
  );

  app.post<{ Params: { templateId: string; versionId: string } }>(
    '/prompt-templates/:templateId/versions/:versionId/publish',
    async (request, reply) => {
      const version = await deps.promptAdminService.getVersion(request.params.versionId);
      if (!version || version.templateId !== request.params.templateId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt version not found: ${request.params.versionId}`,
        );
      }
      try {
        const published = await deps.promptAdminService.publishVersion(
          request.params.versionId,
          adminCtx(request),
        );
        sendJson(reply, 200, toPromptVersionDto(published));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.post<{ Params: { templateId: string; versionId: string } }>(
    '/prompt-templates/:templateId/versions/:versionId/rollback',
    async (request, reply) => {
      const version = await deps.promptAdminService.getVersion(request.params.versionId);
      if (!version || version.templateId !== request.params.templateId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt version not found: ${request.params.versionId}`,
        );
      }
      try {
        const rolledBack = await deps.promptAdminService.rollbackVersion(
          request.params.versionId,
          adminCtx(request),
        );
        sendJson(reply, 200, toPromptVersionDto(rolledBack));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.get<{ Params: { templateId: string } }>(
    '/prompt-templates/:templateId/export',
    async (request, reply) => {
      const bundle = await deps.promptAdminService.exportPublishedContent(request.params.templateId);
      if (!bundle) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `prompt template not found or no published version: ${request.params.templateId}`,
        );
      }
      reply.header('content-type', 'text/plain; charset=utf-8');
      reply.header(
        'content-disposition',
        `attachment; filename="prompt-${bundle.template_key}-export.txt"`,
      );
      reply.send(bundle.content);
    },
  );
}
