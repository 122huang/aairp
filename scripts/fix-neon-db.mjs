/**
 * One-time fix for Neon after a partial migrate (composite PK on migration_history).
 * Usage: node scripts/fix-neon-db.mjs  (requires DATABASE_URL in env or .env loaded by caller)
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), '../packages/infrastructure/package.json'),
);
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function tableExists() {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'infra' AND table_name = 'migration_history'`,
  );
  return r.rowCount > 0;
}

async function pkIsComposite() {
  const r = await pool.query(
    `SELECT a.attname
     FROM pg_index i
     JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = 'infra.migration_history'::regclass AND i.indisprimary
     ORDER BY a.attnum`,
  );
  const cols = r.rows.map((row) => row.attname);
  return cols.length === 2 && cols.includes('version') && cols.includes('name');
}

try {
  if (!(await tableExists())) {
    console.log('infra.migration_history not found — nothing to fix (run pnpm migrate).');
    process.exit(0);
  }

  if (await pkIsComposite()) {
    console.log('migration_history PK already (version, name) — OK.');
    process.exit(0);
  }

  console.log('Fixing migration_history primary key...');
  await pool.query('ALTER TABLE infra.migration_history DROP CONSTRAINT pk_migration_history');
  await pool.query('ALTER TABLE infra.migration_history ADD PRIMARY KEY (version, name)');
  console.log('Done. Run pnpm migrate next.');
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await pool.end();
}
