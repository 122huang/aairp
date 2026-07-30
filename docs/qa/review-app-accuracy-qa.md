# Review-app accuracy QA (post #18–#26)

Manual checks for SKU input (#18), claim-relevant evidence retrieval (#19), and claim-anchor evidence cards (#17 B1 + #20 B2).

## Prerequisites

```powershell
# Requires Postgres (Docker or local). From repo root:
docker compose up -d   # when Docker available
pnpm dev:api           # http://127.0.0.1:3000
pnpm dev:review        # http://127.0.0.1:5173/review/
```

`.env` must include `DATABASE_URL`, `DEEPSEEK_API_KEY` (live evidence judgment).

---

## 1. SKU path (#18)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1 | Open **单条审查**, country **SG**, category **sa.rice_cooker** | Form loads |
| 2 | Ad text: `Family-sized capacity — feed up to 6 people with PC201.` | — |
| 3 | **产品型号**填 `PC201`，提交审查 | Case created |
| 4 | Open a capacity / quantitative finding → upload evidence | Evidence panel opens |
| 5 | Upload `CLM-012884` capacity memo (or paste text from fixture) | Judgment runs |
| 6 | Read judgment context | Shows **`SKU: PC201`**, not `(not provided)` |
| 7 | Re-open case from **案例列表** | **产品型号** prefilled with `PC201` |

**Fixture reference:** `benchmark/evidence-judgment-fixture.json` → `CLM-012884-internal-capacity`.

---

## 2. Long evidence / Step-2 retrieval (#19)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1 | Same ad + finding as above | — |
| 2 | Upload evidence where **substantiation is in the last ~2k chars** (prefix is filler or boilerplate) | Upload succeeds |
| 3 | Check API logs or judgment reasoning | Prompt window includes claim-relevant tail (e.g. `8-10 people`, `245g`), not only prefix filler |
| 4 | Judgment outcome | `relevance: strong` / `sufficiency: sufficient` when evidence supports claim (conservative ad ≤ evidence upper bound) |

**Automated lock:** `packages/application/src/evidence/evidence-text-retrieval.spec.ts` → `selectEvidenceTextForPrompt prefers claim-relevant tail`.

**Synthetic long-evidence paste:** repeat a filler paragraph until >12k chars, append:
`Method: calibrated scale, 245g reference, supports 8-10 people.`

---

## 3. Claim-anchor evidence card (#17 B1 + #20 B2)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 1 | Submit ad with **two findings sharing the same claim anchor** (or one anchor, two risk types) | Findings list shows **one grouped row** per anchor (#20) |
| 2 | Evidence panel | **One upload card** per claim anchor, not one per finding |
| 3 | Upload evidence once | All findings under that anchor show **attached** / shared judgment |
| 4 | Upload second evidence on same anchor | Fan-out attach to anchor group |

**Automated lock:** `apps/review-app/src/lib/finding-merge.spec.ts`.

---

## Automated smoke (no UI / no Postgres)

From repo root:

```powershell
node scripts/qa-accuracy-smoke.mjs
```

Covers: evidence judgment eval 20/20, retrieval + SKU unit tests, finding-merge tests.

---

## Sign-off

| Check | Date | Result | Notes |
|-------|------|--------|-------|
| SKU PC201 in judgment | | ☐ PASS ☐ FAIL | |
| Long evidence tail in window | | ☐ PASS ☐ FAIL | |
| One card per claim anchor | | ☐ PASS ☐ FAIL | |
| Automated smoke | | ☐ PASS ☐ FAIL | |

When all manual rows PASS, accuracy milestone (#18–#26) is **QA-complete**.
