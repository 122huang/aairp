# PRD — Preview Feedback

## User

- Legal reviewer using Knowledge Preview
- Knowledge engineer triaging improvement signals

## Problem

Preview shows relevant knowledge but there is no channel to signal whether the guidance was useful or needs corpus updates.

## Use case

After generating a Knowledge Preview report, the reviewer taps **Yes** or **Needs update**. The system records metadata linked to the active Knowledge Pack — without storing claim text.

## Acceptance criteria

- [ ] Yes / Needs update buttons on Preview tab
- [ ] `POST /api/knowledge/preview/feedback` persists metadata to JSONL
- [ ] Records include: pack ID, fingerprint, corpus fingerprints, matched skills, matched corpus entries, evaluation reference
- [ ] `claim_text_hash` only — no claim text in feedback store
- [ ] Optional `X-Knowledge-Reviewer-Role` header
- [ ] Lifecycle starts at `captured`
- [ ] No runtime / LLM / rule engine involvement

## Privacy

See [KNOWLEDGE-FEEDBACK-LOOP.md](../knowledge/KNOWLEDGE-FEEDBACK-LOOP.md) § Privacy boundary.

## Demo notes

Route: `/knowledge/` → Review Preview → generate report → submit feedback
