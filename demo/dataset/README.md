# Demo Advertisement Dataset

Sprint 1.5 Epic 4 — **8 countries × 4 categories = 32** independent demo ads for `POST /demo/review`.

> Demo-only samples. Not legal advice. Manual cases use `intent` labels for pilot feedback.

## Layout

```
demo/dataset/
  index.json              # dataset manifest
  {COUNTRY}/{category}/   # e.g. SG/health.supplement/sg-health-reject-cure.json
```

## Countries & categories

| Countries | Categories |
|-----------|------------|
| SG, MY, TH, ID, JP, KR, AU, PH | `health.supplement`, `cosmetic`, `food`, `electronics` |

Each country has one ad per category (32 total).

## Case file schema

| Field | Required | Description |
|-------|----------|-------------|
| `case_id` | yes | Unique ID (kebab-case) |
| `country_id` | yes | ISO-style country code |
| `category_id` | yes | Product category |
| `platform_id` | yes | Ad platform (default META) |
| `intent` | yes | `PASS` / `WARN` / `REJECT` / `EDGE` — pilot label |
| `verification` | yes | `auto` (engine ground truth) or `manual` (pilot only) |
| `upload` | yes | Payload for `POST /demo/review` or `/demo/advertisements` |
| `ground_truth` | yes | Expected engine output for eval (`expected_decision`, etc.) |
| `notes` | no | Reviewer notes |

## Canonical sample ad

`SG/health.supplement/sg-health-reject-cure.json` — migrated from `demo/sample-ad-upload.json` (T11 backward compat kept).

## Run a single case (API must be running)

```powershell
.\scripts\demo-review.ps1 -Case sg-health-reject-cure
```

## Evaluate full dataset

```powershell
pnpm eval:dataset           # all 32 cases via upload → pipeline
pnpm eval:dataset -- --auto # auto-verified cases only
```

## Add / remove cases

1. Add JSON under `{COUNTRY}/{category}/`
2. Register in `index.json` `cases[]`
3. Set `ground_truth` for eval (`PASS` if no rules apply yet)
4. Run `pnpm eval:dataset`

## Benchmark binding

- Pipeline benchmark: `benchmark/ad-manifest.json` (SG health regression)
- Dataset eval: `demo/dataset/index.json` (full 32-case upload path)
