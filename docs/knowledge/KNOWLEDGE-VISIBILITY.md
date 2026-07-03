# Knowledge Visibility Layer

Sprint 5F introduces the first AAIRP product surface for governed knowledge — visualization and read-only preview only. Runtime pipeline, rule engine, LLM execution, and benchmark evaluation are unchanged.

## Architecture

```
Corpus → Manifest → Knowledge Pack → Visibility Snapshot → knowledge-ui
                                              ↓
                              knowledge-preview.service (API / CLI)
```

### Snapshot boundary

`apps/knowledge-ui/public/knowledge-visibility.snapshot.json` is the **only** data source for the UI. The UI must not load raw corpus JSON files.

Build:

```bash
pnpm knowledge:build-visibility-snapshot
```

### Preview boundary

`knowledge-preview.service.ts` is deterministic:

| Allowed | Not allowed |
|---------|-------------|
| Taxonomy lookup | Compliance decision |
| Linkage traversal | Risk scoring |
| Evidence requirement lookup | LLM inference |
| Rewrite guidance lookup | Rule execution |
| Case reference lookup | |

## UI host

- App: `apps/knowledge-ui/`
- Route: `/knowledge/` (served by API static registration)
- `admin-ui` unchanged; no coupling in 5F

## Pack release behavior

| State | UI behavior |
|-------|-------------|
| Released pack exists | Status: **Released** (normal) |
| Draft pack only | Status: **Draft preview** + persistent warning |

Warning text (non-dismissible):

> Draft knowledge pack. Not approved for compliance use.

Development workflows may run with draft packs; the build does **not** fail when no released pack exists.

## Skill matching (preview)

Preview reports include:

- `matched_skills[]` — all skills with signal-term matches
- `primary_skill` — highest-scoring match for presentation only

`primary_skill` must not become runtime decision logic.

## Commands

```bash
pnpm knowledge:build-visibility-snapshot
pnpm knowledge:preview -- --text "99.9999% bacteria removal" --country SG
```

## Product documentation

- [PRD — Knowledge Dashboard](./product/PRD-KNOWLEDGE-DASHBOARD.md)
- [PRD — Knowledge Graph Explorer](./product/PRD-KNOWLEDGE-EXPLORER.md)
- [PRD — Review Preview](./product/PRD-REVIEW-PREVIEW.md)

## Future (5G+)

- Preview API authentication, audit logging, permission model
- External exposure hardening
- Full-text corpus search UI
