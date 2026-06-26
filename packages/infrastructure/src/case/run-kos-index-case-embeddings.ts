import { Pool } from 'pg';
import {
  CaseEmbeddingIndexerService,
  DeterministicHashEmbeddingProvider,
} from '@aairp/application';
import { PgCaseEmbeddingRepository, PgCaseKosRepository, PgDatabaseClient } from '../index.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = new PgDatabaseClient(pool);
  const caseKosRepository = new PgCaseKosRepository(db);
  const embeddingRepository = new PgCaseEmbeddingRepository(db);
  const embeddingProvider = new DeterministicHashEmbeddingProvider();
  const indexer = new CaseEmbeddingIndexerService(embeddingProvider);

  try {
    const result = await indexer.indexFromKosRepository(caseKosRepository, embeddingRepository);
    console.log('KOS case embedding index complete');
    console.log(`  indexed: ${result.indexed}, skipped: ${result.skipped}`);
    for (const item of result.items) {
      console.log(`  ${item.case_id} v${item.case_version}: ${item.action}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
