# Release Checklist — MVP Pilot

- [ ] `docker compose up -d` healthy
- [ ] `.env` copied from `.env.example`
- [ ] `pnpm install && pnpm build && pnpm test` green
- [ ] `pnpm eval:benchmark -- --regression` green (SG health, 6 cases)
- [ ] `pnpm eval:golden -- --no-write` green (Golden v1: 82 runnable — 61 text + 20 image + 1 doc fixtures; 2 video skip)
- [ ] `pnpm eval:dataset` green (32 cases)
- [ ] `scripts/smoke-test.ps1` green
- [ ] `POST /demo/review` with `demo/sample-ad-upload.json` → REJECT
- [ ] `report_html` opens in browser
- [ ] Known issues reviewed ([docs/known-issues.md](docs/known-issues.md))
- [ ] Deployment checklist ([docs/deployment-checklist.md](docs/deployment-checklist.md))
- [ ] `.\scripts\release-gate.ps1` (add `-SkipLive` if API not up)
- [ ] Pilot feedback template shared ([docs/trial-feedback-template.md](docs/trial-feedback-template.md))
- [ ] Internal Pilot closeout started ([docs/internal-pilot/checklist.md](docs/internal-pilot/checklist.md))
