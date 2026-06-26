export type QueryResultRow = Record<string, unknown>;

export interface DatabaseClient {
  query<T extends QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export type TransactionRunner = {
  withTransaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;
};

export interface CacheClient {
  ping(): Promise<string>;
}

export type MigrationHistoryRow = {
  version: string;
  name: string;
};
