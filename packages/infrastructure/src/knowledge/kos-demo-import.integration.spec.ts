import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { KosDemoImportService, KosPublishService, resolveDemoKnowledgePaths } from '@aairp/application';
import { PgAuditLogRepository } from './pg-audit-log.repository.js';
import { PgDatabaseClient } from '../persistence/pg-database.client.js';
import { PgKosPublishRepository } from './pg-kos-publish.repository.js';
import { PgPlaybookRepository } from './pg-playbook.repository.js';
import { PgPromptRepository } from './pg-prompt.repository.js';
import { PgRegulationRepository } from './pg-regulation.repository.js';
import { PgRegulationRepository } from './pg-regulation.repository.js';
import { PgRuleRepository } from './pg-rule.repository.js';

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('KosDemoImportService integration', () => {
  let pool: Pool;
  let importService: KosDemoImportService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const db = new PgDatabaseClient(pool);
    const auditLogRepository = new PgAuditLogRepository(db);
    const publishService = new KosPublishService(
      new PgKosPublishRepository(db, auditLogRepository),
    );

    importService = new KosDemoImportService({
      ruleRepository: new PgRuleRepository(db),
      playbookRepository: new PgPlaybookRepository(db),
      promptRepository: new PgPromptRepository(db),
      regulationRepository: new PgRegulationRepository(db),
      publishService,
      paths: resolveDemoKnowledgePaths(),
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('imports demo knowledge and is idempotent on second run', async () => {
    const first = await importService.importAll();
    expect(first.rules).toHaveLength(3);
    expect(first.regulations).toHaveLength(3);
    expect(['published', 'skipped']).toContain(first.playbook.action);
    expect(['published', 'skipped']).toContain(first.prompt.action);

    const second = await importService.importAll();
    expect(second.rules.every((item) => item.action === 'skipped')).toBe(true);
    expect(second.regulations.every((item) => item.action === 'skipped')).toBe(true);
    expect(second.regulations.every((item) => item.action === 'skipped')).toBe(true);
    expect(second.playbook.action).toBe('skipped');
    expect(second.prompt.action).toBe('skipped');
  });
});
