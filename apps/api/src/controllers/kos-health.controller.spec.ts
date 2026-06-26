import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import type { KosPublishService, KosSearchService, RegulationAdminService, RuleAdminService } from '@aairp/application';
import { registerKosRoutes } from '../kos/register-kos-routes.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createSearchServiceMock(): KosSearchService {
  return {
    search: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    }),
  } as unknown as KosSearchService;
}

function createPublishServiceMock(): KosPublishService {
  return {
    publish: vi.fn(),
    rollback: vi.fn(),
  } as unknown as KosPublishService;
}

function createRegulationAdminServiceMock(): RegulationAdminService {
  return {} as unknown as RegulationAdminService;
}

function createRuleAdminServiceMock(): RuleAdminService {
  return {} as unknown as RuleAdminService;
}

async function buildTestApp() {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerKosRoutes(app, {
    serviceName: 'aairp-api-kos',
    version: '0.1.0-sprint2a',
    kosSearchService: createSearchServiceMock(),
    kosPublishService: createPublishServiceMock(),
    regulationAdminService: createRegulationAdminServiceMock(),
    ruleAdminService: createRuleAdminServiceMock(),
  });
  await app.ready();
  return app;
}

describe('registerKosRoutes', () => {
  it('GET /kos/v1/health returns 200', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/kos/v1/health',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      api_prefix: '/kos/v1',
    });
    await app.close();
  });
});

describe('AppError NOT_FOUND', () => {
  it('maps to not-found problem type', () => {
    const error = new AppError('NOT_FOUND', 404, 'Not Found', 'missing resource');
    const problem = error.toProblemDetails('/kos/v1/rules/x', 'trace-1');
    expect(problem.type).toBe('https://aairp.example.com/problems/not-found');
  });
});
