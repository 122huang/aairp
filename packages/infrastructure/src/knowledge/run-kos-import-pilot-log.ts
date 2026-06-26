import { Pool } from 'pg';
import {
  PilotFeedbackImportService,
  resolvePilotLogPath,
} from '@aairp/application';
import { PgDatabaseClient } from '../persistence/pg-database.client.js';
import { PgFeedbackRepository } from '../knowledge/pg-feedback.repository.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exitCode = 1;
    return;
  }

  const csvPath = resolvePilotLogPath();
  const pool = new Pool({ connectionString: databaseUrl });
  const db = new PgDatabaseClient(pool);
  const importService = new PilotFeedbackImportService({
    feedbackRepository: new PgFeedbackRepository(db),
  });

  try {
    const result = await importService.importFromCsv(csvPath);
    console.log(`Pilot feedback import complete from ${csvPath}`);
    console.log(`  imported: ${result.imported}, updated: ${result.updated}`);
    for (const item of result.items) {
      console.log(`  ${item.case_id} (${item.pilot_id}): ${item.action}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
