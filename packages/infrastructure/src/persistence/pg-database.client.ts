import type { Pool } from 'pg';
import type { DatabaseClient, TransactionRunner } from './clients.js';

export class PgDatabaseClient implements DatabaseClient, TransactionRunner {
  constructor(private readonly pool: Pool) {}

  async query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }> {
    const result = await this.pool.query<T>(sql, params);
    return { rows: result.rows };
  }

  async withTransaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const tx: DatabaseClient = {
        query: async <T extends Record<string, unknown>>(sql: string, params?: unknown[]) => {
          const result = await client.query<T>(sql, params);
          return { rows: result.rows };
        },
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
