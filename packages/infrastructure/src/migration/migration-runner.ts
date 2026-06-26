import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type MigrationFile = {
  fileName: string;
  filePath: string;
  version: string;
  name: string;
  sortKey: string;
};

const SAME_VERSION_ORDER: Record<string, number> = {
  init_database: 10,
  create_migration_history: 20,
  create_schema_lock: 30,
  grants: 40,
  knowledge_tables: 10,
  audit_events: 20,
};

const MIGRATION_FILE_PATTERN = /^V(\d+\.\d+\.\d+)__(.+)\.sql$/i;

export function parseMigrationFileName(fileName: string): Omit<MigrationFile, 'filePath'> | null {
  const match = MIGRATION_FILE_PATTERN.exec(fileName);
  if (!match) {
    return null;
  }

  const version = match[1]!;
  const slug = match[2]!;
  const order = SAME_VERSION_ORDER[slug] ?? 999;

  return {
    fileName,
    version,
    name: `V${version}__${slug}`,
    sortKey: `${version.split('.').map((p) => p.padStart(4, '0')).join('.')}.${String(order).padStart(4, '0')}.${slug}`,
  };
}

export function sortMigrationFiles(files: MigrationFile[]): MigrationFile[] {
  return [...files].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export async function loadMigrationFiles(migrationsDir: string): Promise<MigrationFile[]> {
  const entries = await readdir(migrationsDir);
  const files: MigrationFile[] = [];

  for (const entry of entries) {
    const parsed = parseMigrationFileName(entry);
    if (!parsed) {
      continue;
    }
    files.push({
      ...parsed,
      filePath: join(migrationsDir, entry),
    });
  }

  return sortMigrationFiles(files);
}

export function computeChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function readMigrationSql(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8');
}

export type AppliedMigrationRow = {
  version: string;
  name: string;
};

export function isMigrationApplied(
  applied: AppliedMigrationRow[],
  migration: MigrationFile,
): boolean {
  return applied.some((row) => row.version === migration.version && row.name === migration.name);
}

export type MigrationRunResult = {
  applied: string[];
  skipped: string[];
};

export type MigrationExecutor = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

export async function runPendingMigrations(options: {
  migrationsDir: string;
  executor: MigrationExecutor;
  applied: AppliedMigrationRow[];
}): Promise<MigrationRunResult> {
  const files = await loadMigrationFiles(options.migrationsDir);
  const applied: string[] = [];
  const skipped: string[] = [];
  let historyReady = options.applied.some((row) => row.name === 'V1.0.0__create_migration_history');
  const pendingHistoryBackfill: MigrationFile[] = [];

  async function recordMigration(file: MigrationFile, sql: string, started: number): Promise<void> {
    const checksum = computeChecksum(sql);
    await options.executor.query(
      `INSERT INTO infra.migration_history
         (version, name, checksum, execution_time_ms, success)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [file.version, file.name, checksum, Math.round(performance.now() - started)],
    );
    options.applied.push({ version: file.version, name: file.name });
  }

  for (const file of files) {
    if (isMigrationApplied(options.applied, file)) {
      skipped.push(file.name);
      continue;
    }

    const started = performance.now();
    const sql = await readMigrationSql(file.filePath);

    await options.executor.query('BEGIN');
    try {
      await options.executor.query(sql);

      if (historyReady) {
        await recordMigration(file, sql, started);
      } else if (file.name === 'V1.0.0__create_migration_history') {
        historyReady = true;
        await recordMigration(file, sql, started);
        for (const pending of pendingHistoryBackfill) {
          const pendingSql = await readMigrationSql(pending.filePath);
          await recordMigration(pending, pendingSql, started);
        }
        pendingHistoryBackfill.length = 0;
      } else {
        pendingHistoryBackfill.push(file);
      }

      await options.executor.query('COMMIT');
      applied.push(file.name);
    } catch (error) {
      await options.executor.query('ROLLBACK');
      throw error;
    }
  }

  return { applied, skipped };
}

export function resolveMigrationsDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../migrations');
}

export function migrationBasename(filePath: string): string {
  return basename(filePath);
}
