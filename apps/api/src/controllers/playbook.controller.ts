import type { FastifyInstance } from 'fastify';
import type { PlaybookAdminService } from '@aairp/application';
import { AppError, KosPublishError } from '@aairp/shared-kernel';
import { toPaginatedResponseDto } from '../dto/kos-pagination.dto.js';
import {
  toPlaybookPackDto,
  toPlaybookPatternDto,
  toPlaybookVersionDto,
} from '../dto/playbook.dto.js';
import { sendJson } from '../middleware/http.js';
import {
  parseCreatePlaybookPackBody,
  parseCreatePlaybookPatternBody,
  parseKosActorHeaders,
  parsePlaybookListQuery,
  parseUpdatePlaybookPatternBody,
} from '../validation/playbook-request.js';

export type PlaybookControllerDeps = {
  playbookAdminService: PlaybookAdminService;
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

export async function registerPlaybookController(
  app: FastifyInstance,
  deps: PlaybookControllerDeps,
): Promise<void> {
  app.get('/playbook-packs', async (request, reply) => {
    const query = parsePlaybookListQuery(request.query as Record<string, unknown>);
    const result = await deps.playbookAdminService.listPacks(query);
    sendJson(
      reply,
      200,
      toPaginatedResponseDto({
        items: result.items.map(toPlaybookPackDto),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      }),
    );
  });

  app.post('/playbook-packs', async (request, reply) => {
    const body = parseCreatePlaybookPackBody(request.body);
    const pack = await deps.playbookAdminService.createPack(
      {
        packKey: body.pack_key,
        name: body.name,
        description: body.description,
      },
      adminCtx(request),
    );
    sendJson(reply, 201, toPlaybookPackDto(pack));
  });

  app.get<{ Params: { packId: string } }>(
    '/playbook-packs/:packId',
    async (request, reply) => {
      const pack = await deps.playbookAdminService.getPack(request.params.packId);
      if (!pack) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook pack not found: ${request.params.packId}`,
        );
      }
      sendJson(reply, 200, toPlaybookPackDto(pack));
    },
  );

  app.get<{ Params: { packId: string } }>(
    '/playbook-packs/:packId/versions',
    async (request, reply) => {
      const pack = await deps.playbookAdminService.getPack(request.params.packId);
      if (!pack) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook pack not found: ${request.params.packId}`,
        );
      }
      const status =
        typeof (request.query as Record<string, unknown>).status === 'string'
          ? ((request.query as Record<string, unknown>).status as
              | 'DRAFT'
              | 'PUBLISHED'
              | 'ARCHIVED')
          : undefined;
      const versions = await deps.playbookAdminService.listVersions(
        request.params.packId,
        status,
      );
      sendJson(reply, 200, { versions: versions.map((version) => toPlaybookVersionDto(version)) });
    },
  );

  app.post<{ Params: { packId: string } }>(
    '/playbook-packs/:packId/versions',
    async (request, reply) => {
      const pack = await deps.playbookAdminService.getPack(request.params.packId);
      if (!pack) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook pack not found: ${request.params.packId}`,
        );
      }
      const version = await deps.playbookAdminService.createVersion(
        { playbookPackId: request.params.packId },
        adminCtx(request),
      );
      sendJson(reply, 201, toPlaybookVersionDto(version));
    },
  );

  app.get<{ Params: { packId: string; versionId: string } }>(
    '/playbook-packs/:packId/versions/:versionId',
    async (request, reply) => {
      const version = await deps.playbookAdminService.getVersion(request.params.versionId);
      if (!version || version.playbookPackId !== request.params.packId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook version not found: ${request.params.versionId}`,
        );
      }
      sendJson(reply, 200, toPlaybookVersionDto(version));
    },
  );

  app.post<{ Params: { packId: string; versionId: string } }>(
    '/playbook-packs/:packId/versions/:versionId/publish',
    async (request, reply) => {
      const version = await deps.playbookAdminService.getVersion(request.params.versionId);
      if (!version || version.playbookPackId !== request.params.packId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook version not found: ${request.params.versionId}`,
        );
      }
      try {
        const published = await deps.playbookAdminService.publishVersion(
          request.params.versionId,
          adminCtx(request),
        );
        sendJson(reply, 200, toPlaybookVersionDto(published));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.post<{ Params: { packId: string; versionId: string } }>(
    '/playbook-packs/:packId/versions/:versionId/rollback',
    async (request, reply) => {
      const version = await deps.playbookAdminService.getVersion(request.params.versionId);
      if (!version || version.playbookPackId !== request.params.packId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook version not found: ${request.params.versionId}`,
        );
      }
      try {
        const rolledBack = await deps.playbookAdminService.rollbackVersion(
          request.params.versionId,
          adminCtx(request),
        );
        sendJson(reply, 200, toPlaybookVersionDto(rolledBack));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.get<{ Params: { packId: string; versionId: string } }>(
    '/playbook-packs/:packId/versions/:versionId/patterns',
    async (request, reply) => {
      const version = await deps.playbookAdminService.getVersion(request.params.versionId);
      if (!version || version.playbookPackId !== request.params.packId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook version not found: ${request.params.versionId}`,
        );
      }
      const patterns = await deps.playbookAdminService.listPatterns(request.params.versionId);
      sendJson(reply, 200, { patterns: patterns.map((pattern) => toPlaybookPatternDto(pattern)) });
    },
  );

  app.post<{ Params: { packId: string; versionId: string } }>(
    '/playbook-packs/:packId/versions/:versionId/patterns',
    async (request, reply) => {
      const version = await deps.playbookAdminService.getVersion(request.params.versionId);
      if (!version || version.playbookPackId !== request.params.packId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook version not found: ${request.params.versionId}`,
        );
      }
      const body = parseCreatePlaybookPatternBody(request.body);
      try {
        const pattern = await deps.playbookAdminService.createPattern(
          {
            playbookVersionId: request.params.versionId,
            refId: body.ref_id,
            matchType: body.match_type,
            terms: body.terms,
            guidance: body.guidance,
            markdownBody: body.markdown_body,
          },
          adminCtx(request),
        );
        sendJson(reply, 201, toPlaybookPatternDto(pattern));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.get<{ Params: { packId: string; versionId: string; patternId: string } }>(
    '/playbook-packs/:packId/versions/:versionId/patterns/:patternId',
    async (request, reply) => {
      const version = await deps.playbookAdminService.getVersion(request.params.versionId);
      if (!version || version.playbookPackId !== request.params.packId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook version not found: ${request.params.versionId}`,
        );
      }
      const pattern = await deps.playbookAdminService.getPattern(request.params.patternId);
      if (!pattern || pattern.playbookVersionId !== request.params.versionId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook pattern not found: ${request.params.patternId}`,
        );
      }
      sendJson(reply, 200, toPlaybookPatternDto(pattern));
    },
  );

  app.patch<{ Params: { packId: string; versionId: string; patternId: string } }>(
    '/playbook-packs/:packId/versions/:versionId/patterns/:patternId',
    async (request, reply) => {
      const version = await deps.playbookAdminService.getVersion(request.params.versionId);
      if (!version || version.playbookPackId !== request.params.packId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook version not found: ${request.params.versionId}`,
        );
      }
      const existing = await deps.playbookAdminService.getPattern(request.params.patternId);
      if (!existing || existing.playbookVersionId !== request.params.versionId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook pattern not found: ${request.params.patternId}`,
        );
      }
      const body = parseUpdatePlaybookPatternBody(request.body);
      try {
        const updated = await deps.playbookAdminService.updatePattern(
          request.params.patternId,
          {
            refId: body.ref_id,
            matchType: body.match_type,
            terms: body.terms,
            guidance: body.guidance,
            markdownBody: body.markdown_body,
          },
          adminCtx(request),
        );
        sendJson(reply, 200, toPlaybookPatternDto(updated));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.get<{ Params: { packId: string } }>(
    '/playbook-packs/:packId/export',
    async (request, reply) => {
      const bundle = await deps.playbookAdminService.exportMarkdown(request.params.packId);
      if (!bundle) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `playbook pack not found or no published version: ${request.params.packId}`,
        );
      }
      reply.header('content-type', 'text/markdown; charset=utf-8');
      reply.header(
        'content-disposition',
        `attachment; filename="playbook-${bundle.pack_key}-export.md"`,
      );
      reply.send(bundle.markdown);
    },
  );
}
