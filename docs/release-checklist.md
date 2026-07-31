# Release Checklist — MVP Pilot

## Rule / Compiler pack changes (required)

When changing `demo/rules.demo.json`, Hook Specs, or fusion guardrails — **mandatory** (also enforced in `.github/workflows/ci.yml`):

- [ ] `pnpm test:compiler-gates` green（= validate-hook-specs + decision-invariants）
- [ ] `node scripts/_gen_coverage_matrix.mjs` (refresh matrix if market/rule scope changed)
- [ ] Pack version bumped; `DEMO_KNOWLEDGE_VERSIONS.rulePackVersion` aligned if hardcoded
- [ ] 对外演示：确认 citation 已法务 sign-off，**或** UI/材料仍展示 `CITATION_DEMO_DISCLAIMER`

Minimal Compiler eval subset:

```bash
pnpm test:compiler-gates
pnpm eval:dataset
```

## Pilot gate

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
