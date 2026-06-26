import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { KosSearchService } from '@aairp/application';
import { registerKosSearchController } from './kos-search.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createSearchServiceMock(): KosSearchService {
  return {
    search: vi.fn().mockResolvedValue({
      items: [
        {
          objectType: 'rule',
          objectId: 'rv-1',
          title: 'SG-HEALTH-CURE',
          snippet: 'Prohibits cure claims',
          meta: { source: 'postgres' },
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    }),
  } as unknown as KosSearchService;
}

async function buildTestApp(searchService: KosSearchService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerKosSearchController(app, { kosSearchService: searchService });
  await app.ready();
  return app;
}

describe('KosSearchController', () => {
  it('GET /search returns paginated hits', async () => {
    const searchService = createSearchServiceMock();
    const app = await buildTestApp(searchService);

    const response = await app.inject({
      method: 'GET',
      url: '/search?type=rule&q=cure&country_id=SG',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(searchService.search).toHaveBeenCalledWith({
      type: 'rule',
      q: 'cure',
      countryId: 'SG',
      categoryId: undefined,
      limit: 20,
      offset: 0,
    });
    expect(response.json()).toMatchObject({
      total: 1,
      limit: 20,
      offset: 0,
      type: 'rule',
      q: 'cure',
      country_id: 'SG',
      items: [
        {
          object_type: 'rule',
          object_id: 'rv-1',
          title: 'SG-HEALTH-CURE',
        },
      ],
    });
    await app.close();
  });

  it('GET /search?type=invalid returns 400', async () => {
    const app = await buildTestApp(createSearchServiceMock());

    const response = await app.inject({
      method: 'GET',
      url: '/search?type=invalid',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    await app.close();
  });

  it('GET /search?foo=bar returns 400 for unknown query', async () => {
    const app = await buildTestApp(createSearchServiceMock());

    const response = await app.inject({
      method: 'GET',
      url: '/search?foo=bar',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe('parseKosSearchQuery integration', () => {
  it('AppError for invalid type uses problem+json shape', async () => {
    const app = await buildTestApp(createSearchServiceMock());
    const response = await app.inject({
      method: 'GET',
      url: '/search?type=bad',
      headers: { accept: 'application/json' },
    });
    expect(response.json()).toMatchObject({
      title: 'Bad Request',
      detail: 'Invalid query parameter: type',
    });
    await app.close();
  });
});
