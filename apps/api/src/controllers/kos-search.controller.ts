import type { FastifyInstance } from 'fastify';
import type { KosSearchService } from '@aairp/application';
import { toKosSearchResponseDto } from '../dto/kos-search.dto.js';
import { createProbePreHandler, sendJson } from '../middleware/http.js';
import {
  assertOnlyKnownKosSearchQueryParams,
  parseKosSearchQuery,
  toKosSearchFilters,
} from '../validation/kos-search-query.js';

export type KosSearchControllerDeps = {
  kosSearchService: KosSearchService;
};

export async function registerKosSearchController(
  app: FastifyInstance,
  deps: KosSearchControllerDeps,
): Promise<void> {
  const probePreHandler = createProbePreHandler();

  app.get(
    '/search',
    { preHandler: probePreHandler },
    async (request, reply) => {
      assertOnlyKnownKosSearchQueryParams(request.query as Record<string, unknown>);
      const query = parseKosSearchQuery(request.query as Record<string, unknown>);
      const result = await deps.kosSearchService.search(toKosSearchFilters(query));

      sendJson(
        reply,
        200,
        toKosSearchResponseDto(result, {
          type: query.type,
          q: query.q,
          country_id: query.country_id,
          category_id: query.category_id,
        }),
      );
    },
  );
}
