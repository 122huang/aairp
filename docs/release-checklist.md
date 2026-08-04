# Release Checklist — MVP Pilot

## Rule / pack / fusion changes (required)

When changing `demo/rules.demo.json`, Hook Specs, or fusion guardrails — **mandatory**:

- [ ] `pnpm test:compiler-gates` green  
  （实质 = `validate-hook-specs` + `decision-invariants`；**不是**自动把法条编译成规则。名称历史遗留。）
- [ ] 亦由 **CI**（`.github/workflows/ci.yml`）与本地 **`.\scripts\release-gate.ps1`** 强制执行（后者在 smoke 之前跑）
- [ ] `node scripts/_gen_coverage_matrix.mjs` (refresh matrix if market/rule scope changed)
- [ ] Pack version bumped; `DEMO_KNOWLEDGE_VERSIONS.rulePackVersion` aligned if hardcoded
- [ ] 对外演示：确认 citation 已法务 sign-off，**或** UI/材料仍展示 `CITATION_DEMO_DISCLAIMER`

Minimal eval subset after rule changes:

```bash
pnpm test:compiler-gates
pnpm eval:dataset
# if APAC legal P0 touched:
# pnpm eval:apac-legal-p0-golden
```

## Pilot gate

- [ ] `docker compose up -d` healthy
- [ ] `.env` copied from `.env.example`
- [ ] `pnpm install && pnpm build && pnpm test` green
- [ ] `pnpm eval:benchmark -- --regression` green (SG health, 6 cases)
- [ ] `pnpm eval:golden -- --no-write` green (Golden v1: 82 runnable — 61 text + 20 image + 1 doc fixtures; 2 video skip)
- [ ] `pnpm eval:dataset` green (32 cases)
- [ ] `scripts/smoke-test.ps1` green（含在 release-gate 内；release-gate 另含 compiler-gates）
- [ ] `POST /demo/review` with `demo/sample-ad-upload.json` → REJECT
- [ ] `report_html` opens in browser
- [ ] Known issues reviewed ([docs/known-issues.md](docs/known-issues.md))
- [ ] Deployment checklist ([docs/deployment-checklist.md](docs/deployment-checklist.md))
- [ ] `.\scripts\release-gate.ps1` (add `-SkipLive` if API not up；**必含** `test:compiler-gates`)
- [ ] Pilot feedback template shared ([docs/trial-feedback-template.md](docs/trial-feedback-template.md))
- [ ] Internal Pilot closeout started ([docs/internal-pilot/checklist.md](docs/internal-pilot/checklist.md))
