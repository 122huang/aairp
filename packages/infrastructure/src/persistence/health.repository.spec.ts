import { describe, expect, it, vi } from 'vitest';
import { HealthRepository } from './health.repository.js';
import type { CacheClient, DatabaseClient } from './clients.js';

describe('HealthRepository', () => {
  it('pingDatabase returns up on successful SELECT 1', async () => {
    const database: DatabaseClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
    };
    const cache: CacheClient = { ping: vi.fn() };
    const repository = new HealthRepository(database, cache);

    const result = await repository.pingDatabase();

    expect(result.status).toBe('up');
    expect(result.latencyMs).toBeTypeOf('number');
  });

  it('pingDatabase returns down when query fails', async () => {
    const database: DatabaseClient = {
      query: vi.fn().mockRejectedValue(new Error('connection refused')),
    };
    const cache: CacheClient = { ping: vi.fn() };
    const repository = new HealthRepository(database, cache);

    const result = await repository.pingDatabase();

    expect(result).toEqual({
      status: 'down',
      error: 'connection refused',
    });
  });

  it('pingCache returns up when redis responds PONG', async () => {
    const database: DatabaseClient = { query: vi.fn() };
    const cache: CacheClient = { ping: vi.fn().mockResolvedValue('PONG') };
    const repository = new HealthRepository(database, cache);

    const result = await repository.pingCache();

    expect(result.status).toBe('up');
  });

  it('getMigrationStatus returns down when no rows exist', async () => {
    const database: DatabaseClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };
    const cache: CacheClient = { ping: vi.fn() };
    const repository = new HealthRepository(database, cache);

    const result = await repository.getMigrationStatus();

    expect(result.status).toBe('down');
    expect(result.error).toBe('no migrations applied');
  });

  it('getMigrationStatus returns schema version when migration exists', async () => {
    const database: DatabaseClient = {
      query: vi.fn().mockResolvedValue({
        rows: [{ version: '1.0.0', name: 'V1.0.0__grants' }],
      }),
    };
    const cache: CacheClient = { ping: vi.fn() };
    const repository = new HealthRepository(database, cache);

    const result = await repository.getMigrationStatus();

    expect(result).toMatchObject({
      status: 'up',
      schemaVersion: '1.0.0',
      latestMigration: 'V1.0.0__grants',
    });
  });
});
