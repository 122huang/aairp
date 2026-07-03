# PRD — Review Preview

## User

- Legal reviewer — wants a quick read on what governed knowledge applies to a claim
- BD / sales — demos AAIRP capability without triggering full compliance review

## Problem

There is no lightweight way to show "what knowledge would be relevant" for a claim text without running the full review pipeline, rule engine, or LLM.

## Use case

As a legal reviewer, I paste a claim such as `99.9999% bacteria removal`, select country SG, and receive a **Knowledge Preview Report** listing matched skills, linked regulations, evidence requirements, rewrite guidance, and related cases — with explicit disclaimer that this is not a compliance decision.

## Acceptance criteria

- [ ] `POST /api/knowledge/preview` accepts `claim_text`, optional `country`, `category`, `modality`
- [ ] CLI: `pnpm knowledge:preview -- --text "…" --country SG`
- [ ] Output uses **"Relevant knowledge found"** — never **"Violation detected"**
- [ ] Every report includes non-dismissible disclaimer
- [ ] Draft pack warning included in API response and UI when applicable
- [ ] Returns `matched_skills[]` and `primary_skill` (presentation metadata only)
- [ ] `primary_skill` is not used as runtime decision logic
- [ ] No imports from review pipeline, rule engine, or LLM gateway
- [ ] Preview API calls logged with `knowledge_pack_id`, `input_hash`, `matched_skills[]`
- [ ] Markdown export to `reports/knowledge-preview-{timestamp}.md` via CLI

## Screenshots / demo notes

- Tab: **Review Preview** on `/knowledge/`
- Default sample claim: `99.9999% bacteria removal` / SG
- Show matched skills chips with primary highlighted
- Show draft banner above disclaimer when pack is draft-only
- Pilot: internal network access only; auth deferred to Sprint 5G
