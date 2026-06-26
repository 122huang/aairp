import { Pool } from 'pg';
import { CaseImportService, resolveCaseLibraryRoot } from '@aairp/application';
import { PgDatabaseClient } from '../persistence/pg-database.client.js';
import { PgCaseKosRepository } from './pg-case-kos.repository.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exitCode = 1;
    return;
  }

  const rootPath = resolveCaseLibraryRoot(process.env.AAIRP_CASE_LIBRARY_PATH);
  const pool = new Pool({ connectionString: databaseUrl });
  const db = new PgDatabaseClient(pool);
  const importService = new CaseImportService({
    caseKosRepository: new PgCaseKosRepository(db),
  });

  try {
    const result = await importService.importFromDirectory(rootPath);
    console.log(`KOS case import complete from ${rootPath}`);
    console.log(`  imported: ${result.imported}, skipped: ${result.skipped}`);
    for (const item of result.items) {
      console.log(`  ${item.case_id}: ${item.action}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
