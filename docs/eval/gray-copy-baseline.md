# Gray-copy Open Risk baseline

In-process gray-copy eval measures **Open Risk capability**: LLM hits an acceptable `risk_type`, or a Rule/Playbook finding covers the same risk class (`rule_covered_same_risk`). Final pipeline decision alone is not the score.

## Run

From repo root (loads `.env` when present):

```powershell
node scripts/run-gray-copy-with-env.mjs
```

Filter cases:

```powershell
pnpm eval:gray-copy -- --countries=SG,MY,TH --copyIds=5,8
```

Requires `AAIRP_OPEN_RISK_MODE=live` (or equivalent LLM env) in `.env` for real LLM scoring. Without live mode, stub responses apply and capability numbers are not meaningful.

Reports: `reports/eval-gray-copy-*.json` and `.md`.

## Baseline (2026-07-29)

| Metric | Value |
|--------|------:|
| Capability pass | **28 / 32 (87.5%)** |
| Main reference | post–PR #25 (`open-risk` parse retry) |
| Mode | in-process live Open Risk |

### Notes

- **LLM variance:** expect 27–29/32 between runs on the same commit. Failures often rotate across `gray-CN-05`, `gray-CN-08`, `gray-SG-08`, `gray-MY-05`, `gray-TH-08`, and comparative classes — not always the same four cases.
- **Masked vs miss:** `masked_by_unrelated` (incidental CPSR/COE/internet-ad rules with empty LLM) counts as FAIL. Do not change incidental rule handling to inflate gray scores.
- **Docker live gray:** full API path (`docker compose` + `pnpm dev:api` + `scripts/run-gray-reviews.cjs`) is deferred until Docker Desktop is available. Use in-process gray for prompt/rule regression until then.

## Fixture

`benchmark/gray-copy-fixture.json` — 8 gray classes × CN/SG/MY/TH = 32 cases. Copy texts avoid Rule/Playbook trigger keywords so scores reflect semantic Open Risk, not keyword coincidence.

Prompt few-shots for volatile SG/MY/TH environmental (copy_id 5) and scarcity (copy_id 8) cases: `demo/open-risk.prompt.txt` Few-shots G–H (`demo-open-risk-1.5.6+`).
