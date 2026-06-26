import { Pool } from 'pg';
import {
  resolveMigrationsDir,
  runPendingMigrations,
  type AppliedMigrationRow,
} from './migration-runner.js';

async function loadAppliedMigrations(pool: Pool): Promise<AppliedMigrationRow[]> {
  try {
    const appliedResult = await pool.query<AppliedMigrationRow>(
      `SELECT version, name FROM infra.migration_history WHERE success = TRUE`,
    );
    return appliedResult.rows;
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const migrationsDir = resolveMigrationsDir();

  try {
    const applied = await loadAppliedMigrations(pool);

    const result = await runPendingMigrations({
      migrationsDir,
      applied,
      executor: {
        query: async (sql, params) => {
          const response = await pool.query(sql, params);
          return { rows: response.rows as Record<string, unknown>[] };
        },
      },
    });

    console.log(`Migrations dir: ${migrationsDir}`);
    if (result.skipped.length > 0) {
      console.log(`Skipped (${result.skipped.length}): ${result.skipped.join(', ')}`);
    }
    if (result.applied.length > 0) {
      console.log(`Applied (${result.applied.length}): ${result.applied.join(', ')}`);
    } else {
      console.log('No pending migrations.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
