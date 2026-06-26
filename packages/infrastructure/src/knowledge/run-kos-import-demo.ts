import { Pool } from 'pg';
import {
  KosDemoImportService,
  KosPublishService,
  resolveDemoKnowledgePaths,
} from '@aairp/application';
import { PgAuditLogRepository } from './pg-audit-log.repository.js';
import { PgDatabaseClient } from '../persistence/pg-database.client.js';
import { PgKosPublishRepository } from './pg-kos-publish.repository.js';
import { PgPlaybookRepository } from './pg-playbook.repository.js';
import { PgPromptRepository } from './pg-prompt.repository.js';
import { PgRegulationRepository } from './pg-regulation.repository.js';
import { PgRuleRepository } from './pg-rule.repository.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = new PgDatabaseClient(pool);
  const auditLogRepository = new PgAuditLogRepository(db);
  const publishService = new KosPublishService(
    new PgKosPublishRepository(db, auditLogRepository),
  );

  const importService = new KosDemoImportService({
    ruleRepository: new PgRuleRepository(db),
    playbookRepository: new PgPlaybookRepository(db),
    promptRepository: new PgPromptRepository(db),
    regulationRepository: new PgRegulationRepository(db),
    publishService,
    paths: resolveDemoKnowledgePaths(),
  });

  try {
    const result = await importService.importAll();

    console.log('KOS demo import complete');
    for (const regulation of result.regulations) {
      console.log(
        `  regulation ${regulation.key}: ${regulation.action}${regulation.versionId ? ` (${regulation.versionId})` : ''}`,
      );
    }
    for (const rule of result.rules) {
      console.log(`  rule ${rule.key}: ${rule.action}${rule.versionId ? ` (${rule.versionId})` : ''}`);
    }
    console.log(
      `  playbook ${result.playbook.key}: ${result.playbook.action}${result.playbook.versionId ? ` (${result.playbook.versionId})` : ''}`,
    );
    console.log(
      `  prompt ${result.prompt.key}: ${result.prompt.action}${result.prompt.versionId ? ` (${result.prompt.versionId})` : ''}`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
