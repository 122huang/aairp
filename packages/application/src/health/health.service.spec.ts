import { describe, expect, it, vi } from 'vitest';
import { HealthService } from './health.service.js';
import type { IHealthRepository } from '@aairp/domain';

function createRepository(
  overrides: Partial<IHealthRepository> = {},
): IHealthRepository {
  return {
    pingDatabase: vi.fn().mockResolvedValue({ status: 'up', latencyMs: 2 }),
    pingCache: vi.fn().mockResolvedValue({ status: 'up', latencyMs: 1 }),
    getMigrationStatus: vi.fn().mockResolvedValue({
      status: 'up',
      schemaVersion: '1.0.0',
      latestMigration: 'V1.0.0__grants',
    }),
    ...overrides,
  };
}

describe('HealthService', () => {
  const fixedDate = new Date('2026-06-26T10:00:00.000Z');

  it('checkLiveness returns ok without calling repository', () => {
    const repository = createRepository();
    const service = new HealthService(repository, {
      serviceName: 'aairp-api',
      version: '0.1.0-sprint1',
      now: () => fixedDate,
    });

    const result = service.checkLiveness();

    expect(result).toEqual({
      status: 'ok',
      service: 'aairp-api',
      version: '0.1.0-sprint1',
      timestamp: '2026-06-26T10:00:00.000Z',
    });
    expect(repository.pingDatabase).not.toHaveBeenCalled();
    expect(repository.pingCache).not.toHaveBeenCalled();
    expect(repository.getMigrationStatus).not.toHaveBeenCalled();
  });

  it('checkReadiness returns ready when all dependencies are up', async () => {
    const repository = createRepository();
    const service = new HealthService(repository, {
      serviceName: 'aairp-api',
      version: '0.1.0-sprint1',
      now: () => fixedDate,
    });

    const result = await service.checkReadiness();

    expect(result.status).toBe('ready');
    expect(result.checks.database.status).toBe('up');
    expect(result.checks.cache.status).toBe('up');
    expect(result.checks.migration.schemaVersion).toBe('1.0.0');
  });

  it('checkReadiness returns not_ready when database is down', async () => {
    const repository = createRepository({
      pingDatabase: vi.fn().mockResolvedValue({
        status: 'down',
        error: 'connection refused',
      }),
    });
    const service = new HealthService(repository, {
      serviceName: 'aairp-api',
      version: '0.1.0-sprint1',
      now: () => fixedDate,
    });

    const result = await service.checkReadiness();

    expect(result.status).toBe('not_ready');
    expect(result.checks.database.error).toBe('connection refused');
  });

  it('checkReadiness returns not_ready when migration is down', async () => {
    const repository = createRepository({
      getMigrationStatus: vi.fn().mockResolvedValue({
        status: 'down',
        error: 'no migrations applied',
      }),
    });
    const service = new HealthService(repository, {
      serviceName: 'aairp-api',
      version: '0.1.0-sprint1',
      now: () => fixedDate,
    });

    const result = await service.checkReadiness();

    expect(result.status).toBe('not_ready');
    expect(result.checks.migration.status).toBe('down');
  });

  it('checkReadiness runs dependency checks in parallel', async () => {
    const repository = createRepository();
    const service = new HealthService(repository, {
      serviceName: 'aairp-api',
      version: '0.1.0-sprint1',
      now: () => fixedDate,
    });

    await service.checkReadiness();

    expect(repository.pingDatabase).toHaveBeenCalledTimes(1);
    expect(repository.pingCache).toHaveBeenCalledTimes(1);
    expect(repository.getMigrationStatus).toHaveBeenCalledTimes(1);
  });
});
