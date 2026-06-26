import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { AppError } from '@aairp/shared-kernel';
import type { HealthService } from '@aairp/application';
import { registerHealthController } from './health.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createHealthServiceMock(): HealthService {
  return {
    checkLiveness: vi.fn().mockReturnValue({
      status: 'ok',
      service: 'aairp-api',
      version: '0.1.0-sprint1',
      timestamp: '2026-06-26T10:00:00.000Z',
    }),
    checkReadiness: vi.fn().mockResolvedValue({
      status: 'ready',
      timestamp: '2026-06-26T10:00:00.000Z',
      checks: {
        database: { status: 'up', latencyMs: 3 },
        cache: { status: 'up', latencyMs: 1 },
        migration: {
          status: 'up',
          schemaVersion: '1.0.0',
          latestMigration: 'V1.0.0__grants',
        },
      },
    }),
  } as unknown as HealthService;
}

async function buildTestApp(healthService: HealthService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerHealthController(app, { healthService });
  await app.ready();
  return app;
}

describe('HealthController', () => {
  let healthService: HealthService;

  beforeEach(() => {
    healthService = createHealthServiceMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /health returns 200 with liveness payload', async () => {
    const app = await buildTestApp(healthService);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-trace-id']).toBeTypeOf('string');
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'aairp-api',
      version: '0.1.0-sprint1',
      timestamp: '2026-06-26T10:00:00.000Z',
    });
    expect(healthService.checkLiveness).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('POST /health returns 405 problem+json', async () => {
    const app = await buildTestApp(healthService);

    const response = await app.inject({
      method: 'POST',
      url: '/health',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(405);
    expect(response.headers['content-type']).toContain('application/problem+json');
    await app.close();
  });

  it('GET /ready returns 200 when service is ready', async () => {
    const app = await buildTestApp(healthService);

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ready',
      timestamp: '2026-06-26T10:00:00.000Z',
    });
    await app.close();
  });

  it('GET /ready?verbose=true includes checks', async () => {
    const app = await buildTestApp(healthService);

    const response = await app.inject({
      method: 'GET',
      url: '/ready?verbose=true',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ready',
      checks: {
        database: { status: 'up', latency_ms: 3 },
        migration: {
          status: 'up',
          schema_version: '1.0.0',
          latest_migration: 'V1.0.0__grants',
        },
      },
    });
    await app.close();
  });

  it('GET /ready returns 503 with checks when not ready', async () => {
    vi.mocked(healthService.checkReadiness).mockResolvedValue({
      status: 'not_ready',
      timestamp: '2026-06-26T10:00:00.000Z',
      checks: {
        database: { status: 'down', error: 'connection refused' },
        cache: { status: 'up', latencyMs: 1 },
        migration: { status: 'down', error: 'no migrations applied' },
      },
    });
    const app = await buildTestApp(healthService);

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({
      title: 'Service Unavailable',
      status: 503,
      checks: {
        database: { status: 'down', error: 'connection refused' },
        migration: { status: 'down', error: 'no migrations applied' },
      },
    });
    await app.close();
  });

  it('GET /ready?verbose=invalid returns 400', async () => {
    const app = await buildTestApp(healthService);

    const response = await app.inject({
      method: 'GET',
      url: '/ready?verbose=invalid',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      title: 'Bad Request',
      detail: 'Invalid query parameter: verbose',
    });
    await app.close();
  });

  it('GET /ready?foo=bar returns 400 for unknown query', async () => {
    const app = await buildTestApp(healthService);

    const response = await app.inject({
      method: 'GET',
      url: '/ready?foo=bar',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      detail: 'Invalid query parameter: foo',
    });
    await app.close();
  });

  it('returns 406 when Accept is unsupported', async () => {
    const app = await buildTestApp(healthService);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { accept: 'text/html' },
    });

    expect(response.statusCode).toBe(406);
    await app.close();
  });
});

describe('query validation helpers', () => {
  it('AppError exposes RFC7807 type suffix for bad request', () => {
    const error = new AppError(
      'INVALID_REQUEST',
      400,
      'Bad Request',
      'Invalid query parameter: verbose',
    );
    const problem = error.toProblemDetails('/ready', 'trace-1');
    expect(problem.type).toBe('https://aairp.example.com/problems/bad-request');
  });
});
