import type { FastifyInstance } from 'fastify';
import type { RuleAdminService } from '@aairp/application';
import { AppError, KosPublishError } from '@aairp/shared-kernel';
import { toPaginatedResponseDto } from '../dto/kos-pagination.dto.js';
import {
  toRuleDefinitionDto,
  toRulePackDto,
  toRulePackExportDto,
  toRuleVersionDto,
} from '../dto/rule.dto.js';
import { sendJson } from '../middleware/http.js';
import {
  parseCreateRuleBody,
  parseCreateRulePackBody,
  parseCreateRuleVersionBody,
  parseKosActorHeaders,
  parseRuleListQuery,
  parseSetRegulationLinksBody,
  parseUpdateRuleVersionBody,
} from '../validation/rule-request.js';

export type RuleControllerDeps = {
  ruleAdminService: RuleAdminService;
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

export async function registerRuleController(
  app: FastifyInstance,
  deps: RuleControllerDeps,
): Promise<void> {
  app.get('/rule-packs', async (request, reply) => {
    const query = parseRuleListQuery(request.query as Record<string, unknown>);
    const result = await deps.ruleAdminService.listPacks(query);
    sendJson(
      reply,
      200,
      toPaginatedResponseDto({
        items: result.items.map(toRulePackDto),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      }),
    );
  });

  app.post('/rule-packs', async (request, reply) => {
    const body = parseCreateRulePackBody(request.body);
    const pack = await deps.ruleAdminService.createPack(
      {
        packKey: body.pack_key,
        name: body.name,
        description: body.description,
      },
      adminCtx(request),
    );
    sendJson(reply, 201, toRulePackDto(pack));
  });

  app.get<{ Params: { packId: string } }>('/rule-packs/:packId', async (request, reply) => {
    const pack = await deps.ruleAdminService.getPack(request.params.packId);
    if (!pack) {
      throw new AppError('NOT_FOUND', 404, 'Not Found', `rule pack not found: ${request.params.packId}`);
    }
    sendJson(reply, 200, toRulePackDto(pack));
  });

  app.get<{ Params: { packId: string } }>(
    '/rule-packs/:packId/rules',
    async (request, reply) => {
      const pack = await deps.ruleAdminService.getPack(request.params.packId);
      if (!pack) {
        throw new AppError('NOT_FOUND', 404, 'Not Found', `rule pack not found: ${request.params.packId}`);
      }
      const query = parseRuleListQuery(request.query as Record<string, unknown>);
      const result = await deps.ruleAdminService.listRules(request.params.packId, query);
      sendJson(
        reply,
        200,
        toPaginatedResponseDto({
          items: result.items.map(toRuleDefinitionDto),
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        }),
      );
    },
  );

  app.post<{ Params: { packId: string } }>(
    '/rule-packs/:packId/rules',
    async (request, reply) => {
      const pack = await deps.ruleAdminService.getPack(request.params.packId);
      if (!pack) {
        throw new AppError('NOT_FOUND', 404, 'Not Found', `rule pack not found: ${request.params.packId}`);
      }
      const body = parseCreateRuleBody(request.body);
      const rule = await deps.ruleAdminService.createRule(
        {
          rulePackId: request.params.packId,
          ruleKey: body.rule_key,
          displayName: body.display_name,
        },
        adminCtx(request),
      );
      sendJson(reply, 201, toRuleDefinitionDto(rule));
    },
  );

  app.get<{ Params: { packId: string } }>(
    '/rule-packs/:packId/export',
    async (request, reply) => {
      const bundle = await deps.ruleAdminService.exportPack(request.params.packId);
      if (!bundle) {
        throw new AppError('NOT_FOUND', 404, 'Not Found', `rule pack not found: ${request.params.packId}`);
      }
      reply.header('content-type', 'application/json; charset=utf-8');
      reply.header(
        'content-disposition',
        `attachment; filename="rule-pack-${bundle.pack_key}-export.json"`,
      );
      reply.send(toRulePackExportDto(bundle));
    },
  );

  app.get<{ Params: { ruleId: string } }>('/rules/:ruleId', async (request, reply) => {
    const rule = await deps.ruleAdminService.getRule(request.params.ruleId);
    if (!rule) {
      throw new AppError('NOT_FOUND', 404, 'Not Found', `rule not found: ${request.params.ruleId}`);
    }
    sendJson(reply, 200, toRuleDefinitionDto(rule));
  });

  app.get<{ Params: { ruleId: string } }>(
    '/rules/:ruleId/versions',
    async (request, reply) => {
      const rule = await deps.ruleAdminService.getRule(request.params.ruleId);
      if (!rule) {
        throw new AppError('NOT_FOUND', 404, 'Not Found', `rule not found: ${request.params.ruleId}`);
      }
      const status =
        typeof (request.query as Record<string, unknown>).status === 'string'
          ? ((request.query as Record<string, unknown>).status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED')
          : undefined;
      const versions = await deps.ruleAdminService.listVersions(request.params.ruleId, status);
      sendJson(reply, 200, { versions: versions.map((v) => toRuleVersionDto(v)) });
    },
  );

  app.post<{ Params: { ruleId: string } }>(
    '/rules/:ruleId/versions',
    async (request, reply) => {
      const rule = await deps.ruleAdminService.getRule(request.params.ruleId);
      if (!rule) {
        throw new AppError('NOT_FOUND', 404, 'Not Found', `rule not found: ${request.params.ruleId}`);
      }
      const body = parseCreateRuleVersionBody(request.body);
      const version = await deps.ruleAdminService.createVersion(
        {
          ruleId: request.params.ruleId,
          severity: body.severity,
          decision: body.decision,
          summary: body.summary,
          scope: body.scope,
          payload: body.payload ?? {},
          owner: body.owner,
          tags: body.tags,
        },
        adminCtx(request),
      );
      if (body.regulation_version_ids && body.regulation_version_ids.length > 0) {
        await deps.ruleAdminService.setRegulationVersionLinks(
          version.ruleVersionId,
          body.regulation_version_ids,
          adminCtx(request),
        );
      }
      const links = await deps.ruleAdminService.listRegulationVersionIds(version.ruleVersionId);
      sendJson(reply, 201, toRuleVersionDto(version, links));
    },
  );

  app.get<{ Params: { ruleId: string; versionId: string } }>(
    '/rules/:ruleId/versions/:versionId',
    async (request, reply) => {
      const version = await deps.ruleAdminService.getVersion(request.params.versionId);
      if (!version || version.ruleId !== request.params.ruleId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `rule version not found: ${request.params.versionId}`,
        );
      }
      const links = await deps.ruleAdminService.listRegulationVersionIds(version.ruleVersionId);
      sendJson(reply, 200, toRuleVersionDto(version, links));
    },
  );

  app.patch<{ Params: { ruleId: string; versionId: string } }>(
    '/rules/:ruleId/versions/:versionId',
    async (request, reply) => {
      const version = await deps.ruleAdminService.getVersion(request.params.versionId);
      if (!version || version.ruleId !== request.params.ruleId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `rule version not found: ${request.params.versionId}`,
        );
      }
      const body = parseUpdateRuleVersionBody(request.body);
      try {
        const updated = await deps.ruleAdminService.updateVersion(
          request.params.versionId,
          {
            severity: body.severity,
            decision: body.decision,
            summary: body.summary,
            scope: body.scope,
            payload: body.payload,
            owner: body.owner,
            tags: body.tags,
          },
          adminCtx(request),
        );
        if (body.regulation_version_ids) {
          await deps.ruleAdminService.setRegulationVersionLinks(
            request.params.versionId,
            body.regulation_version_ids,
            adminCtx(request),
          );
        }
        const links = await deps.ruleAdminService.listRegulationVersionIds(updated.ruleVersionId);
        sendJson(reply, 200, toRuleVersionDto(updated, links));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.put<{ Params: { ruleId: string; versionId: string } }>(
    '/rules/:ruleId/versions/:versionId/regulation-links',
    async (request, reply) => {
      const version = await deps.ruleAdminService.getVersion(request.params.versionId);
      if (!version || version.ruleId !== request.params.ruleId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `rule version not found: ${request.params.versionId}`,
        );
      }
      const body = parseSetRegulationLinksBody(request.body);
      await deps.ruleAdminService.setRegulationVersionLinks(
        request.params.versionId,
        body.regulation_version_ids,
        adminCtx(request),
      );
      sendJson(reply, 200, { regulation_version_ids: body.regulation_version_ids });
    },
  );

  app.post<{ Params: { ruleId: string; versionId: string } }>(
    '/rules/:ruleId/versions/:versionId/publish',
    async (request, reply) => {
      const version = await deps.ruleAdminService.getVersion(request.params.versionId);
      if (!version || version.ruleId !== request.params.ruleId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `rule version not found: ${request.params.versionId}`,
        );
      }
      try {
        const published = await deps.ruleAdminService.publishVersion(
          request.params.versionId,
          adminCtx(request),
        );
        const links = await deps.ruleAdminService.listRegulationVersionIds(published.ruleVersionId);
        sendJson(reply, 200, toRuleVersionDto(published, links));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );

  app.post<{ Params: { ruleId: string; versionId: string } }>(
    '/rules/:ruleId/versions/:versionId/rollback',
    async (request, reply) => {
      const version = await deps.ruleAdminService.getVersion(request.params.versionId);
      if (!version || version.ruleId !== request.params.ruleId) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `rule version not found: ${request.params.versionId}`,
        );
      }
      try {
        const rolledBack = await deps.ruleAdminService.rollbackVersion(
          request.params.versionId,
          adminCtx(request),
        );
        const links = await deps.ruleAdminService.listRegulationVersionIds(rolledBack.ruleVersionId);
        sendJson(reply, 200, toRuleVersionDto(rolledBack, links));
      } catch (error) {
        mapServiceError(error);
      }
    },
  );
}
