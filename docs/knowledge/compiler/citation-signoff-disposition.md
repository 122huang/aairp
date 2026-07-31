# Citation Sign-off Disposition (engineering + product)

**Date:** 2026-07-31  
**Source:** GPT review of `citation-signoff-batch-ab.md` + internal recalibration  
**Pass:** Citation pass 1 (`scripts/_apply_citation_signoff_pass1.mjs`)

## Adopted position

| Topic | GPT said | Disposition |
| --- | --- | --- |
| Focus on `law_name` + `article` | Correct | **Adopt** — legal sign-off gate on these fields |
| Batch A all need Demo removed | Correct | **Adopt** — pass 1 strips `(Demo)` and binds corpus-backed names |
| Batch B “见手册” articles invalid | Correct | **Adopt** — pass 1 replaces with concrete article text |
| Trademark / food-safety / cert domain mismatch | Correct | **Adopt** — competitor → IP/TM laws; food-safety → Food Acts; cert → substantiation / authenticity |
| “Engine does not know country” | Incorrect | **Reject** — `country_id` is already on the review request; rule scoping uses `scopes.countries` |
| Must immediately split every multi-market rule into 7 `rule_id`s | Overreach | **Defer** — keep shared APAC-SA rules; make multi-market citation strings accurate first. Split only when country-specific triggers/decisions diverge |
| A.3 must not use Health Products Act for appliances | Mis-scoped | **Reject as stated** — `demo-sg-health-forbidden-claim` is `health.supplement` only, not SA. Citation stays HPA §7 |

## Pass 1 engineering actions

1. Update citations for A.1–A.7 and B.1–B.11 high-priority rows in `demo/rules.demo.json`.
2. Bump `pack_version` (1.8.x +1).
3. Keep UI disclaimer (`CITATION_DEMO_DISCLAIMER`) until legal stamps this pass.
4. Do **not** invent per-country `rule_id` explosion in this pass.

## Legal next actions

- [ ] Stamp Batch A rows (law_name / article / status).
- [ ] Stamp Batch B rows; flag any market that still needs split or weaker status.
- [ ] After stamp: remove external-demo disclaimer and record in `DECISIONS-2026-07-31.md`.

## Explicit non-goals this pass

- No ID / IN / VN / PH UI exposure.
- No forced 7× rule_id rewrite of the pack.
- No new markets beyond the seven already on product UI.
