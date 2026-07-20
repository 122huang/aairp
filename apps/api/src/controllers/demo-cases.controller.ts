import type { FastifyInstance } from 'fastify';
import type { CaseSearchService } from '@aairp/application';
import type { ICaseStore } from '@aairp/shared-kernel';
import { AppError } from '@aairp/shared-kernel';
import { toCaseManifestDto } from '../dto/case.dto.js';
import { sendJson } from '../middleware/http.js';
import { parseCaseSearchQuery } from '../validation/case-request.js';

export type DemoCasesControllerDeps = {
  caseSearchService: CaseSearchService;
  caseStore: ICaseStore;
};

/**
 * Review-app facing case history endpoints.
 * Uses the same caseStore as demo review recording (json / dual / kos).
 */
export async function registerDemoCasesController(
  app: FastifyInstance,
  deps: DemoCasesControllerDeps,
): Promise<void> {
  app.get('/demo/cases', async (request, reply) => {
    const filters = parseCaseSearchQuery(request.query as Record<string, unknown>);
    const results = await deps.caseSearchService.search({
      ...filters,
      limit: filters.limit ?? 50,
      offset: filters.offset ?? 0,
    });
    sendJson(reply, 200, {
      count: results.length,
      cases: results.map(toCaseManifestDto),
    });
  });

  app.get<{ Params: { caseId: string } }>('/demo/cases/:caseId', async (request, reply) => {
    const record = await deps.caseStore.findByCaseId(request.params.caseId);
    if (!record) {
      throw new AppError('NOT_FOUND', 404, 'Not Found', `case not found: ${request.params.caseId}`);
    }
    sendJson(reply, 200, record);
  });
}
