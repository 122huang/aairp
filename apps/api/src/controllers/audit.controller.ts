import type { FastifyInstance } from 'fastify';
import type { AuditLogService } from '@aairp/application';
import { AppError } from '@aairp/shared-kernel';
import { toPaginatedResponseDto } from '../dto/kos-pagination.dto.js';
import { toAuditEventDto } from '../dto/audit.dto.js';
import { sendJson } from '../middleware/http.js';
import { parseAuditExportQuery, parseAuditSearchQuery } from '../validation/audit-request.js';

export type AuditControllerDeps = {
  auditLogService: AuditLogService;
};

export async function registerAuditController(
  app: FastifyInstance,
  deps: AuditControllerDeps,
): Promise<void> {
  app.get('/audit-events/export', async (request, reply) => {
    const filters = parseAuditExportQuery(request.query as Record<string, unknown>);
    const csv = await deps.auditLogService.exportCsv(filters);
    reply.header('content-type', 'text/csv; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="audit-events-export.csv"');
    reply.send(csv);
  });

  app.get('/audit-events', async (request, reply) => {
    const filters = parseAuditSearchQuery(request.query as Record<string, unknown>);
    const result = await deps.auditLogService.search(filters);
    sendJson(
      reply,
      200,
      toPaginatedResponseDto({
        items: result.items.map(toAuditEventDto),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      }),
    );
  });

  app.get<{ Params: { auditEventId: string } }>(
    '/audit-events/:auditEventId',
    async (request, reply) => {
      const event = await deps.auditLogService.findById(request.params.auditEventId);
      if (!event) {
        throw new AppError(
          'NOT_FOUND',
          404,
          'Not Found',
          `audit event not found: ${request.params.auditEventId}`,
        );
      }
      sendJson(reply, 200, toAuditEventDto(event));
    },
  );
}
