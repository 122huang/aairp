# Case Corpus

Validation and learning knowledge for the Knowledge Platform — not a case archive, benchmark duplicate, or runtime decision database.

**Plan:** [SPRINT-5D-PLAN.md](../sprint-5/SPRINT-5D-PLAN.md)

## Role

| Case Corpus **is** | Case Corpus **is not** |
|--------------------|------------------------|
| Validation knowledge for eval and regression | A dump of `case-library/` review JSON |
| Learning feedback (promotion metadata, ground truth) | Runtime case storage or KOS replacement |
| Bridge: Benchmark ↔ Skill ↔ Rewrite ↔ Evidence | Duplicate of benchmark-v3 fixture text |

**Graph position:** Regulation → Rule → Skill → Rewrite. Case evaluates Skill, verifies Rewrite, validates Evidence expectations, and references Benchmark via `benchmark_ref`.

## Model

| Field | Role |
|-------|------|
| `benchmark_ref` | benchmark-v3 `case_id` — one CaseEntry per case_id (pilot) |
| `verification_status` | Quality confidence: `unverified` → `human_verified` → `legal_verified` |
| `case_status` | Operational lifecycle: `draft` → `candidate` → `verified` → `regression` → `deprecated` |
| `ground_truth_spec` | Declarative eval expectations (decision, pattern, rewrite, evidence) |
| `case_result` | Declarative outcome linkage: `decision_outcome`, `risk_level`, `matched_skill`, `applied_rewrite`, `evidence_result` |
| `source_case_id` | Locator convention only — full case-library bridge deferred to 5D.1 |

### verification_status vs case_status

Do not merge these concepts.

- **`verification_status`** — how confident we are in the case knowledge (human vs legal review).
- **`case_status`** — where the entry sits in corpus lifecycle.

For pilot: `case_status: verified` requires `verification_status >= human_verified`. `legal_verified` is required only for high-risk regulatory cases, externally published benchmark sets, and production governance packs.

### evidence_validation

Required in `ground_truth_spec` only when linked Skill has `evidence_requirement: required` or linked Rewrite uses `cite_evidence`. Pure wording/disclosure cases may omit it.

## Linkage rules

| Direction | Rule |
|-----------|------|
| Case → Benchmark | `benchmark_ref` must exist in benchmark-v3 |
| Case → Skill / Rewrite / Evidence / Regulation | Cross-corpus validation (error if unknown) |
| Rewrite/Evidence → Case | `case_refs` validated when non-empty (warn if unknown) |
| Case → case-library | Metadata locator only in 5D — no payload import |

## KQS vs benchmark coverage

KQS measures **asset quality** (schema, ground truth, linkage). Benchmark coverage % is reported separately in the Case Gap Report — do not interpret KQS alone as eval maturity.

## Pilot scope (28 entries)

| Cluster | Count (approx.) |
|---------|-----------------|
| Health claims | 6 |
| Performance claims | 5 |
| Comparative claims | 4 |
| Certification claims | 4 |
| Disclosure claims | 9 |

No bulk import of all 92 benchmark cases.

## Commands

```bash
pnpm knowledge:build-case-corpus-index
pnpm knowledge:validate-case-corpus
pnpm knowledge:case-corpus-dashboard
pnpm knowledge:platform-dashboard   # 5 corpora
```

## Related

- [case-corpus/README.md](./case-corpus/README.md)
- [SPRINT-5D-PLAN.md](../sprint-5/SPRINT-5D-PLAN.md)
- [KNOWLEDGE-AUTHORING-STANDARD.md](./KNOWLEDGE-AUTHORING-STANDARD.md)
