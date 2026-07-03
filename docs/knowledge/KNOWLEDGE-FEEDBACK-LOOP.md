# Knowledge Feedback Loop

Sprint 5G closes the operational loop from knowledge consumption to improvement.

## Loop

```
Knowledge (released pack)
    ↓
Preview (deterministic lookup)
    ↓
Human feedback (metadata)
    ↓
Gap analysis (coverage report)
    ↓
Improvement queue (dashboard)
    ↓
Corpus change → new pack release
```

## Feedback lifecycle

Feedback is a **knowledge improvement signal** — not knowledge.

```
Captured → Reviewed → Converted → Implemented → Released
```

5G pilot records `captured` status only. Later stages are manual until workflow automation in Sprint 6+.

## Privacy boundary

### Stored

- Metadata (timestamp, feedback type, lifecycle status)
- Knowledge references (skills, corpus entry IDs, pack fingerprints)
- Evaluation references (baseline ID, regression report path)
- `claim_text_hash` (dedup only)

### Not stored

- Claim text / ad copy
- Customer advertising materials
- Confidential business content
- Uploaded documents
- Free-text compliance reasoning

## Evaluation linkage

Every feedback record and gap report includes:

- `knowledge_pack_id`
- `knowledge_pack_fingerprint`
- `corpus_fingerprints`
- `evaluation_reference`

Regression baseline: `reports/eval-v3-2026-07-01T05-51-15-747Z.json` (`kp-2026.07.3`).

## Commands

```bash
pnpm knowledge:coverage-gap-report
pnpm knowledge:build-visibility-snapshot
pnpm eval:benchmark-v3 -- --tier=regression
```

## Governance flow

```
Knowledge Engineering → Legal Pilot Review → Evaluation Owner → Manual Release
```

No autonomous knowledge publishing.

## Product docs

- [PRD — Preview Feedback](../product/PRD-PREVIEW-FEEDBACK.md)
- [PRD — Coverage Gap Report](../product/PRD-COVERAGE-GAP-REPORT.md)

## Related

- [KNOWLEDGE-VISIBILITY.md](./KNOWLEDGE-VISIBILITY.md)
- [SPRINT-5G-PLAN.md](../sprint-5/SPRINT-5G-PLAN.md)
- [BASELINE-ISSUES.md](../testing/BASELINE-ISSUES.md)
