import type {
  DependencyCheck,
  IHealthRepository,
  MigrationCheck,
} from '@aairp/domain';
import type { CacheClient, DatabaseClient, MigrationHistoryRow } from './clients.js';

async function measureLatency<T>(operation: () => Promise<T>): Promise<{
  result: T;
  latencyMs: number;
}> {
  const started = performance.now();
  const result = await operation();
  return { result, latencyMs: Math.round(performance.now() - started) };
}

export class HealthRepository implements IHealthRepository {
  constructor(
    private readonly database: DatabaseClient,
    private readonly cache: CacheClient,
  ) {}

  async pingDatabase(): Promise<DependencyCheck> {
    try {
      const { latencyMs } = await measureLatency(() =>
        this.database.query<{ ok: number }>('SELECT 1 AS ok'),
      );
      return { status: 'up', latencyMs };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'database ping failed',
      };
    }
  }

  async pingCache(): Promise<DependencyCheck> {
    try {
      const { result, latencyMs } = await measureLatency(() => this.cache.ping());
      if (result !== 'PONG') {
        return { status: 'down', error: `unexpected ping response: ${result}` };
      }
      return { status: 'up', latencyMs };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'cache ping failed',
      };
    }
  }

  async getMigrationStatus(): Promise<MigrationCheck> {
    try {
      const { result, latencyMs } = await measureLatency(() =>
        this.database.query<MigrationHistoryRow>(
          `SELECT version, name
           FROM infra.migration_history
           WHERE success = TRUE
           ORDER BY applied_at DESC
           LIMIT 1`,
        ),
      );

      const row = result.rows[0];
      if (!row) {
        return {
          status: 'down',
          latencyMs,
          error: 'no migrations applied',
        };
      }

      return {
        status: 'up',
        latencyMs,
        schemaVersion: row.version,
        latestMigration: row.name,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'migration check failed',
      };
    }
  }
}
