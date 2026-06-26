# Database migrations

Flyway-style: `V{major}.{minor}.{patch}__{description}.sql`

## Apply (recommended)

```powershell
docker compose up -d postgres
.\scripts\migrate.ps1
# or
pnpm migrate
```

Requires `DATABASE_URL` (default Docker: `postgresql://aairp:aairp@localhost:5432/aairp`).

## Versions

| Version | Files | Purpose |
|---------|-------|---------|
| **1.0.0** | 4 × `V1.0.0__*.sql` | Infra, roles, migration_history |
| **2.0.0** | 3 × `V2.0.0__*.sql` | KOS — 7 objects + audit |

## Order (automatic)

1. `V1.0.0__init_database`
2. `V1.0.0__create_migration_history`
3. `V1.0.0__create_schema_lock`
4. `V1.0.0__grants`
5. `V2.0.0__knowledge_tables`
6. `V2.0.0__audit_events`
7. `V2.0.0__grants`
8. `V2.0.1__case_record_amend`
9. `V2.2.0__case_embedding`

## Rollback (2.0.0)

```sql
DROP TABLE IF EXISTS app.rule_version_regulation CASCADE;
DROP TABLE IF EXISTS app.case_record CASCADE;
DROP TABLE IF EXISTS app.feedback CASCADE;
DROP TABLE IF EXISTS app.review_finding_ref CASCADE;
DROP TABLE IF EXISTS app.review_run CASCADE;
DROP TABLE IF EXISTS app.regulation_version CASCADE;
DROP TABLE IF EXISTS app.regulation CASCADE;
DROP TABLE IF EXISTS app.prompt_version CASCADE;
DROP TABLE IF EXISTS app.prompt_template CASCADE;
DROP TABLE IF EXISTS app.prompt_pack CASCADE;
DROP TABLE IF EXISTS app.playbook_pattern CASCADE;
DROP TABLE IF EXISTS app.playbook_pack_version CASCADE;
DROP TABLE IF EXISTS app.playbook_pack CASCADE;
DROP TABLE IF EXISTS app.rule_version CASCADE;
DROP TABLE IF EXISTS app.rule_definition CASCADE;
DROP TABLE IF EXISTS app.rule_pack CASCADE;
DROP TABLE IF EXISTS audit.audit_event CASCADE;
DROP TYPE IF EXISTS app.pack_version_status CASCADE;
DELETE FROM infra.migration_history WHERE version = '2.0.0';
```

Backup before rollback in production.
