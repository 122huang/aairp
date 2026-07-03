# Legal Pilot — Scope (v1)

**Audience:** Legal / Compliance reviewers (English)  
**Version:** Legal Pilot v1 · 2026-06-26  
**Status:** Internal pilot — not production legal advice

---

## What this pilot is

AAIRP (Advertising AI Review Platform) runs **English ad copy** through a **deterministic, auditable pipeline**:

`Regulation → Rule → Playbook → (optional LLM) → Decision → Report → Case Library`

The Legal Pilot UI is at **http://localhost:3000/demo-ui/** — English labels, 5 fixed SG scenarios, Knowledge Trace with regulation citations.

---

## In scope ✅

| Capability | Detail |
|------------|--------|
| **English ad copy (text)** | Paste or select demo scenarios; primary review input is `content.text` |
| **Singapore health / food demo rules** | BLOCKER on forbidden cure claims; disclosure (#ad); superlative WARN patterns |
| **Regulation citations** | Rule findings link to demo regulation corpus in Knowledge Trace |
| **BLOCKER → skip LLM** | When Rule severity is BLOCKER, LLM step is skipped (deterministic) |
| **HTML review report** | PASS / WARN / REJECT with rationale |
| **Case Library** | Each review saved as a browsable case record |
| **Audit trail** | `review_id`, knowledge pack versions, pipeline log |

---

## Out of scope ❌

| Limitation | What to do instead |
|------------|-------------------|
| **Long images / banners** | No OCR or vision pipeline. Supply `ocr_text` manually if testing image-led ads |
| **Video ads** | Not supported in v1 |
| **Multi-market production rules** | Demo pack is SG-focused; other markets are dataset-only |
| **Production LLM** | Stub LLM in pilot; open-risk step is deterministic demo behaviour |
| **Legal sign-off** | System output is **decision support**, not a substitute for lawyer review |
| **Auth / RBAC** | Open demo API on localhost; no user roles in pilot |
| **Chinese UI** | Legal Pilot UI is English; API reports are already English |

See also: [known-issues.md](../known-issues.md)

---

## Recommended pilot workflow

1. Read this scope document with reviewers  
2. Start API + seed cases (see [README](./README.md))  
3. Run 5 demo scenarios; compare output to expected decision  
4. Complete [PILOT-CHECKLIST.md](./PILOT-CHECKLIST.md)  
5. Collect feedback via [trial-feedback-template.md](../trial-feedback-template.md)  
6. Close internal pilot: [internal-pilot/README.md](../internal-pilot/README.md)

---

## Expected outcomes

| Question | Pilot success looks like |
|----------|-------------------------|
| Can Legal trust the **Rule + citation** path? | REJECT case shows BLOCKER + regulation reference; LLM skipped |
| Is PASS/WARN behaviour explainable? | Knowledge Trace shows which layer fired |
| Is raw LLM comparison clear? | Sidebar “Why not raw LLM?” + skipped LLM on BLOCKER |
| Ready for wider rollout? | **No** — needs auth, real LLM option, more rule packs, image OCR |

---

## Disclaimer

Demo regulations and rules are **simplified training assets**, not authoritative legal sources.  
Do not use pilot output as final compliance clearance without human legal review.
