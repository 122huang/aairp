import type { FastifyInstance } from 'fastify';
import type { CaseExportService, CaseSearchService } from '@aairp/application';
import type { ICaseStore } from '@aairp/shared-kernel';
import { AppError } from '@aairp/shared-kernel';
import { sendJson } from '../middleware/http.js';
import { parseCaseSearchQuery } from '../validation/case-request.js';

export type CaseAdminControllerDeps = {
  caseSearchService: CaseSearchService;
  caseExportService: CaseExportService;
  caseStore: ICaseStore;
};

function markDeprecated(reply: { header: (name: string, value: string) => void }): void {
  reply.header('Deprecation', 'true');
  reply.header('Link', '</kos/v1/cases>; rel="successor-version"');
}

export async function registerCaseAdminController(
  app: FastifyInstance,
  deps: CaseAdminControllerDeps,
): Promise<void> {
  app.get('/admin/cases', async (request, reply) => {
    markDeprecated(reply);
    const filters = parseCaseSearchQuery(request.query as Record<string, unknown>);
    const results = await deps.caseSearchService.search(filters);
    sendJson(reply, 200, {
      count: results.length,
      cases: results,
    });
  });

  app.get('/admin/cases/export', async (_request, reply) => {
    markDeprecated(reply);
    const bundle = await deps.caseExportService.exportJsonBundle();
    reply.header('content-type', 'application/json; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="case-library-export.json"');
    reply.send(bundle);
  });

  app.get<{ Params: { caseId: string } }>('/admin/cases/:caseId', async (request, reply) => {
    markDeprecated(reply);
    const record = await deps.caseStore.findByCaseId(request.params.caseId);
    if (!record) {
      throw new AppError('NOT_FOUND', 404, 'Not Found', `case not found: ${request.params.caseId}`);
    }
    sendJson(reply, 200, record);
  });
}
