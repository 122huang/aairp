# PRD — Knowledge Dashboard

## User

- Legal lead — needs confidence that a governed Knowledge Pack is active
- Knowledge engineer — monitors corpus health and validation status
- Management — sees the five-corpus platform is operational

## Problem

Stakeholders cannot see AAIRP's governed knowledge without reading CLI reports or JSON manifests. Release status, corpus quality, and benchmark coverage are invisible outside engineering workflows.

## Use case

As a legal lead, I open `/knowledge/` and immediately see whether the active pack is **Released** or **Draft preview**, how many entries exist per corpus, and how Knowledge Quality Score (KQS) compares to benchmark coverage — without running review or touching runtime pipelines.

## Acceptance criteria

- [ ] Dashboard loads from `knowledge-visibility.snapshot.json` only (no direct corpus JSON)
- [ ] Pack header shows ID, release status, fingerprint, released timestamp
- [ ] Five corpus cards show entry count, KQS, freshness, validation errors, governance warnings
- [ ] KQS and benchmark coverage are shown in separate sections
- [ ] **Released** pack shows green status pill with no draft banner
- [ ] **Draft-only** pack shows persistent non-dismissible warning banner
- [ ] Snapshot rebuild via `pnpm knowledge:build-visibility-snapshot`

## Screenshots / demo notes

- Route: `http://localhost:3000/knowledge/`
- Default tab: Dashboard
- Demo: run `pnpm knowledge:build-visibility-snapshot` before starting API
- Screenshot focus: pack header + five corpus cards + quality vs coverage panel
