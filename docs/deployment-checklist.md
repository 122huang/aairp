# Deployment Checklist — MVP Pilot

Use before sharing the demo with internal pilot users.

## 1. Infrastructure

- [ ] Docker Desktop running (for PostgreSQL + Redis)
- [ ] `.\scripts\start-deps.ps1` — both containers **healthy**
- [ ] Ports **3000**, **5432**, **6379** available

## 2. Configuration

- [ ] `copy .env.example .env` (or set env vars)
- [ ] `DATABASE_URL=postgresql://aairp:aairp@localhost:5432/aairp`
- [ ] `REDIS_URL=redis://localhost:6379`
- [ ] Optional: `OPEN_RISK_TIMEOUT_MS`, `OPEN_RISK_MAX_RETRIES`

## 3. Build & verify (offline gate)

```powershell
pnpm install
pnpm build
.\scripts\release-gate.ps1
```

Expected: test + benchmark regression + dataset auto eval all pass.

## 4. Start API

```powershell
.\scripts\start-dev.ps1
# or: pnpm dev:api
```

## 5. Live smoke (optional)

```powershell
.\scripts\smoke-test-live.ps1
```

Expected: `/health` 200, `/ready` 200, REJECT + PASS demo reviews.

## 6. Sign-off

- [ ] [release-checklist.md](./release-checklist.md) complete
- [ ] [known-issues.md](./known-issues.md) shared with pilot group
- [ ] Pilot feedback template distributed

## Rollback

Stop API process → `docker compose down` → no persistent business data to migrate.
