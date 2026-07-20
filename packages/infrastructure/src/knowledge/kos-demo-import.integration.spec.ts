import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import {
  DEMO_REGULATION_SEEDS,
  KosDemoImportService,
  KosPublishService,
  resolveDemoKnowledgePaths,
} from '@aairp/application';
import type { DemoRulesFile } from '@aairp/application';
import { PgAuditLogRepository } from './pg-audit-log.repository.js';
import { PgDatabaseClient } from '../persistence/pg-database.client.js';
import { PgKosPublishRepository } from './pg-kos-publish.repository.js';
import { PgPlaybookRepository } from './pg-playbook.repository.js';
import { PgPromptRepository } from './pg-prompt.repository.js';
import { PgRegulationRepository } from './pg-regulation.repository.js';
import { PgRuleRepository } from './pg-rule.repository.js';

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('KosDemoImportService integration', () => {
  let pool: Pool;
  let importService: KosDemoImportService;
  let expectedRuleCount: number;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const db = new PgDatabaseClient(pool);
    const auditLogRepository = new PgAuditLogRepository(db);
    const publishService = new KosPublishService(
      new PgKosPublishRepository(db, auditLogRepository),
    );
    const paths = resolveDemoKnowledgePaths();
    const rulesFile = JSON.parse(readFileSync(paths.rulesJson, 'utf8')) as DemoRulesFile;
    expectedRuleCount = rulesFile.rules.length;

    importService = new KosDemoImportService({
      ruleRepository: new PgRuleRepository(db),
      playbookRepository: new PgPlaybookRepository(db),
      promptRepository: new PgPromptRepository(db),
      regulationRepository: new PgRegulationRepository(db),
      publishService,
      paths,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('imports demo knowledge and is idempotent on second run', async () => {
    const first = await importService.importAll();
    // Assert against current demo pack size (not a stale hard-coded count).
    expect(first.rules).toHaveLength(expectedRuleCount);
    expect(first.regulations).toHaveLength(DEMO_REGULATION_SEEDS.length);
    expect(['published', 'skipped']).toContain(first.playbook.action);
    expect(['published', 'skipped']).toContain(first.prompt.action);

    const second = await importService.importAll();
    expect(second.rules.every((item) => item.action === 'skipped')).toBe(true);
    expect(second.regulations.every((item) => item.action === 'skipped')).toBe(true);
    expect(second.playbook.action).toBe('skipped');
    expect(second.prompt.action).toBe('skipped');
  });
});
