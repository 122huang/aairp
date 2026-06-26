# E0-S2 — Database schema & migration runner

**Status:** Complete (2026-06-26)

## Deliverables

| Item | Path |
|------|------|
| KOS tables V2 | `packages/infrastructure/migrations/V2.0.0__knowledge_tables.sql` |
| Audit events | `packages/infrastructure/migrations/V2.0.0__audit_events.sql` |
| Grants | `packages/infrastructure/migrations/V2.0.0__grants.sql` |
| Migration runner | `packages/infrastructure/src/migration/migration-runner.ts` |
| CLI | `pnpm migrate` / `scripts/migrate.ps1` |
| CI smoke | `.github/workflows/ci.yml` → job `migrate-smoke` |

## V2 tables (7 KOS objects)

| Object | Tables |
|--------|--------|
| Regulation | `regulation`, `regulation_version`, `rule_version_regulation` |
| Rule | `rule_pack`, `rule_definition`, `rule_version` |
| Playbook | `playbook_pack`, `playbook_pack_version`, `playbook_pattern` |
| Prompt | `prompt_pack`, `prompt_template`, `prompt_version` |
| Case | `case_record` |
| Feedback | `feedback` |
| Audit | `audit.audit_event` |

Also: `review_run`, `review_finding_ref` (review index, not a KOS primary object).

## Local usage

```powershell
docker compose up -d postgres
.\scripts\migrate.ps1
```

## DoD checklist

- [x] V2 schema includes **Regulation** + **Case** + search GIN indexes
- [x] Rollback notes in `migrations/README.md`
- [x] Idempotent bootstrap for `migration_history`
- [x] CI migrate-smoke job
- [x] `/ready` unchanged (migration 2.0.0 reported when applied)

## Next

**E0-S3** — `/kos/v1` API gateway
