# Legal Pilot — Reviewer Checklist

**Reviewer:** _______________  
**Date:** _______________  
**Environment:** http://localhost:3000/demo-ui/

---

## Before you start

- [ ] Read [PILOT-SCOPE.md](./PILOT-SCOPE.md) (in / out of scope)
- [ ] Confirm API status pill shows **API ok** (green)
- [ ] Default scenario selected: **Forbidden "cure" → REJECT**

---

## Scenario walkthrough

For each row: run review → check expected decision → open **Knowledge Trace** → note citation quality.

| # | Scenario | Expected | Decision matches? | Citation / trace useful? | Notes |
|---|----------|----------|-------------------|--------------------------|-------|
| 1 | demo-01-reject-cure | REJECT | ☐ | ☐ | LLM step skipped? |
| 2 | demo-02-pass-food | PASS | ☐ | ☐ | |
| 3 | demo-03-warn-disclosure | WARN | ☐ | ☐ | |
| 4 | demo-04-warn-superlative | WARN | ☐ | ☐ | Rule + Playbook both visible? |
| 5 | demo-05-pass-wellness | PASS | ☐ | ☐ | Case saved in library? |

---

## UI / UX (English Legal audience)

- [ ] All tabs and buttons readable without Chinese
- [ ] Pipeline stepper labels clear (Regulation → Rule → … → Case)
- [ ] Review report HTML readable in English
- [ ] Case Library loads after at least one review

---

## Trust & limitations

- [ ] I understand output is **decision support**, not legal clearance
- [ ] I understand **stub LLM** is used in this pilot
- [ ] I understand **long images and video** are out of scope
- [ ] I would / would not recommend next phase: _______________

---

## Feedback

Use [trial-feedback-template.md](../trial-feedback-template.md) or email product/legal lead.

**Top 3 gaps for production:**

1. _______________
2. _______________
3. _______________
