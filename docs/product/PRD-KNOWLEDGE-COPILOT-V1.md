# PRD — Knowledge Copilot V1 (Embedded)

**Status:** S6.2 prototype  
**Persona:** Legal reviewer (primary)  
**Surface:** Review Workspace → Review Result → **Knowledge Basis** panel

---

## Problem

After a compliance review, legal users ask: *“What governed knowledge applies to this copy?”* Today they must open `/knowledge/` separately and re-enter claim text.

## Solution

Embed **deterministic Knowledge Preview** in the Review Result screen as **Knowledge Basis** — same API, same boundaries, in-context UX.

## User story

As a legal reviewer, after I receive a PASS/WARN/REJECT result, I expand **Knowledge Basis** to see which skills, regulations, and evidence requirements the knowledge platform associates with my submitted copy — without triggering a second compliance decision.

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| Full-claim preview for submitted text | Per-finding auto-preview (V1.1) |
| Pack stamp + disclaimer | Document / evidence file viewer |
| Yes / Needs update feedback | Free-text comments |
| Link to Knowledge Explorer | Rule engine re-execution |
| Draft pack warning | LLM-enhanced explanation |

## UX requirements

1. Panel appears only after a successful review submission
2. Uses the **same claim text** the reviewer confirmed before submit
3. Country comes from active review tab (SG / MY / TH)
4. Category from form selection when available
5. Loading, success, empty, and error states
6. Visual style distinct from decision card (blue accent, not green/red)

## Acceptance criteria

- [ ] Knowledge Basis visible on Review Result after submit
- [ ] Preview headline uses “Relevant knowledge found” pattern
- [ ] Disclaimer always visible in panel
- [ ] Feedback captured with pack linkage metadata
- [ ] Explorer deep link when `primary_skill` present
- [ ] Works with multi-country review (per-tab cache)

## Technical reference

[PRODUCT-INTEGRATION-S6.2.md](../architecture/PRODUCT-INTEGRATION-S6.2.md)

## Demo script

1. Open `/review/`
2. Paste: `removes 99.9999% bacteria`
3. Select SG, submit review
4. Expand **Knowledge Basis** — see Performance Claim Review match
5. Click **Needs update** or open Explorer link
