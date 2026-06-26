import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { PgAuditLogRepository } from './pg-audit-log.repository.js';
import { PgKosPublishRepository } from './pg-kos-publish.repository.js';
import { PgDatabaseClient } from '../persistence/pg-database.client.js';

const databaseUrl = process.env.DATABASE_URL;
const describeIntegration = databaseUrl ? describe : describe.skip;

describeIntegration('PgKosPublishRepository integration', () => {
  let pool: Pool;
  let db: PgDatabaseClient;
  let publishRepository: PgKosPublishRepository;
  let rulePackId: string;
  let ruleId: string;
  let draftVersionId: string;
  let archivedVersionId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    db = new PgDatabaseClient(pool);
    const auditRepository = new PgAuditLogRepository(db);
    publishRepository = new PgKosPublishRepository(db, auditRepository);

    const pack = await db.query<{ rule_pack_id: string }>(
      `INSERT INTO app.rule_pack (pack_key, name)
       VALUES ($1, $2)
       RETURNING rule_pack_id`,
      [`kos-publish-it-${Date.now()}`, 'Publish IT Pack'],
    );
    rulePackId = pack.rows[0]!.rule_pack_id;

    const rule = await db.query<{ rule_id: string }>(
      `INSERT INTO app.rule_definition (rule_pack_id, rule_key, display_name)
       VALUES ($1, $2, $3)
       RETURNING rule_id`,
      [rulePackId, 'IT-PUBLISH-RULE', 'Integration Publish Rule'],
    );
    ruleId = rule.rows[0]!.rule_id;

    const v1 = await db.query<{ rule_version_id: string }>(
      `INSERT INTO app.rule_version
         (rule_id, version_number, severity, decision, summary, scope_json, payload_json, status, published_at)
       VALUES ($1, 1, 'HIGH', 'REJECT', 'Version one', '{"countries":["SG"],"categories":[]}'::jsonb, '{}'::jsonb, 'PUBLISHED', NOW())
       RETURNING rule_version_id`,
      [ruleId],
    );
    archivedVersionId = v1.rows[0]!.rule_version_id;

    const v2 = await db.query<{ rule_version_id: string }>(
      `INSERT INTO app.rule_version
         (rule_id, version_number, severity, decision, summary, scope_json, payload_json, status)
       VALUES ($1, 2, 'HIGH', 'REJECT', 'Version two draft', '{"countries":["SG"],"categories":[]}'::jsonb, '{}'::jsonb, 'DRAFT')
       RETURNING rule_version_id`,
      [ruleId],
    );
    draftVersionId = v2.rows[0]!.rule_version_id;
  });

  afterAll(async () => {
    if (rulePackId) {
      await db.query(`DELETE FROM app.rule_pack WHERE rule_pack_id = $1`, [rulePackId]);
    }
    await pool.end();
  });

  it('publish archives previous PUBLISHED and writes PUBLISH audit', async () => {
    const published = await publishRepository.publish('rule', draftVersionId, {
      actor: 'it@test',
      traceId: 'publish-it-1',
    });

    expect(published.status).toBe('PUBLISHED');
    expect(published.versionNumber).toBe(2);

    const statuses = await db.query<{ rule_version_id: string; status: string }>(
      `SELECT rule_version_id, status::text AS status
       FROM app.rule_version
       WHERE rule_id = $1
       ORDER BY version_number`,
      [ruleId],
    );

    expect(statuses.rows).toEqual([
      { rule_version_id: archivedVersionId, status: 'ARCHIVED' },
      { rule_version_id: draftVersionId, status: 'PUBLISHED' },
    ]);

    const audit = await db.query<{ action: string }>(
      `SELECT action FROM audit.audit_event
       WHERE resource_id = $1 AND action = 'PUBLISH'
       ORDER BY occurred_at DESC
       LIMIT 1`,
      [draftVersionId],
    );
    expect(audit.rows[0]?.action).toBe('PUBLISH');
  });

  it('rollback re-publishes archived version and writes ROLLBACK audit', async () => {
    const rolledBack = await publishRepository.rollback('rule', archivedVersionId, {
      actor: 'it@test',
      traceId: 'rollback-it-1',
    });

    expect(rolledBack.status).toBe('PUBLISHED');
    expect(rolledBack.versionNumber).toBe(1);

    const statuses = await db.query<{ rule_version_id: string; status: string }>(
      `SELECT rule_version_id, status::text AS status
       FROM app.rule_version
       WHERE rule_id = $1
       ORDER BY version_number`,
      [ruleId],
    );

    expect(statuses.rows).toEqual([
      { rule_version_id: archivedVersionId, status: 'PUBLISHED' },
      { rule_version_id: draftVersionId, status: 'ARCHIVED' },
    ]);

    const audit = await db.query<{ action: string }>(
      `SELECT action FROM audit.audit_event
       WHERE resource_id = $1 AND action = 'ROLLBACK'
       ORDER BY occurred_at DESC
       LIMIT 1`,
      [archivedVersionId],
    );
    expect(audit.rows[0]?.action).toBe('ROLLBACK');
  });
});
