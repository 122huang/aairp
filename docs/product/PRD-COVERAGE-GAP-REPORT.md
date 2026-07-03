# PRD — Coverage Gap Report

## User

- Knowledge engineer maintaining corpora
- Legal pilot prioritizing corpus work
- Eval owner tracking benchmark ↔ case linkage

## Problem

Gaps (missing regulation links, evidence mappings, unmatched claims) are scattered across validators and tacit knowledge. No prioritized improvement backlog exists.

## Use case

Run `pnpm knowledge:coverage-gap-report` to produce a P1–P5 prioritized backlog and queue summary. Dashboard shows the same queue counts without a separate product surface.

## Acceptance criteria

- [ ] CLI writes `reports/knowledge-gap-{timestamp}.md` + `.json`
- [ ] Deterministic P1–P5 prioritization (no ML)
- [ ] Stamps Knowledge Pack version, fingerprints, evaluation reference
- [ ] Queue summary: P1–P5 counts, evidence gaps, unmapped claims
- [ ] `improvement_queue` embedded in visibility snapshot
- [ ] No runtime pipeline imports

## Demo notes

```bash
pnpm knowledge:coverage-gap-report
pnpm knowledge:build-visibility-snapshot
```

Open Dashboard → Knowledge Improvement Queue section.
