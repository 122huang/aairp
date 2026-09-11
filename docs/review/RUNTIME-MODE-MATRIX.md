# Review runtime mode matrix

**Approved production-equivalent stack (Legal GT calibrated):**

| Layer | Mode |
|---|---|
| Rule | live deterministic (`demo-rule-1.8.21`) |
| Playbook | live deterministic (`demo-playbook-1.7.4`) |
| Open Risk | **stub** (not materially applied unless a canned span is grounded in the copy) |
| Evidence judgment | explicit `AAIRP_EVIDENCE_JUDGMENT_MODE`; unset → stub |
| Fusion | `copy_then_overall` |

Open Risk **live** is experimental only. API key presence does **not** enable it. `AAIRP_OPEN_RISK_MODE=live` is required, and the Review UI must show **实验性 Open Risk 已启用**.

Source of truth for a running process: `GET /demo/runtime-modes` and `runtime_modes` on `POST /demo/review`.

## Environments

Current pack versions below are origin/main demo knowledge: `demo-rule-1.8.21` / `demo-playbook-1.7.4` / Open Risk stub `demo-open-risk-1.5.4` / fusion `copy_then_overall`. This release does not backport later market-accuracy pack bumps.

| Environment | Rule | Playbook | Open Risk | Open Risk provider/model | Evidence | Fusion | Runtime source |
|---|---|---|---|---|---|---|---|
| local development (API `scripts/start-dev.ps1`) | live pack | live pack | **stub default**; live only if `.env` sets `AAIRP_OPEN_RISK_MODE=live` | unused unless live (`OPEN_RISK_LLM_*`) | `.env` / unset→stub | copy_then_overall | `.env` injected by `load-env.ps1`; code default stub |
| local demo / Review UI (`pnpm dev:review` → `/demo` proxy) | same API process | same | **same as API** (no client flag) | same | same | same | UI does not choose mode; it displays API `open_risk_mode` |
| benchmark (SG/MY/TH/KR accuracy, APAC parity) | pack fingerprint in fixture | pack fingerprint | **stub / not invoked** (parity runner is Rule+Playbook only) | n/a | n/a unless evidence eval | copy_then_overall | fixture `open_risk_mode: stub`; CI does not set live |
| CI (`.github/workflows/ci.yml`) | built demo pack | built demo pack | **unset → stub** | n/a | unset → stub | copy_then_overall | workflow env does not set `AAIRP_OPEN_RISK_MODE` |
| Railway / deployed demo | demo pack at deploy | demo pack | **stub unless Railway Variables set live** (`startCommand` does **not** set Open Risk live) | Railway vars if live | `startCommand` forces evidence **live** | copy_then_overall | `railway.toml` + Railway Variables |
| intended production | same calibrated packs | same | **stub / no-go** until a dedicated Open Risk reliability change | n/a | approved evidence mode (Railway: live) | copy_then_overall | must match this matrix; `assertProductionEquivalentRuntime` |

## Gate

`assertProductionEquivalentRuntime()` fails when `open_risk_mode !== stub`.

`review_stack`:

- `production` = Open Risk stub
- `experimental` = Open Risk live

## Stainless steel runtime regression (not a copy exception)

Copy (MY / `sa.other`): *Stainless steel reversible rack. Use to steam, cook on 2 levels, or cook mains and sides at the same time.*

| Stack | Expected |
|---|---|
| production-equivalent (stub) | Rule EECA INFO, Playbook none, Open Risk not applied, copy/overall **PASS** |
| experimental live | may add LLM `material-claim` WARN (FP vs Legal GT PASS); UI badge required |

This does **not** mean “stainless steel is always PASS”. It means approved runtime must not silently add live LLM overlay.

## Deferred (not this change)

UI risk count: overall WARN must not say “发现 2 项需关注的风险” when one finding is EECA INFO. Separate presentation item: INFO vs material WARN / copy-only.
