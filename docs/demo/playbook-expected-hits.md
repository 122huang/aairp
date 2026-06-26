# Demo Playbook — Expected Hit Scenarios (Sprint 1.5 Epic 2)

Reference asset: `demo/playbook.demo.md`  
Runtime: `PlaybookEngineService` (3 patterns)

| Pattern ID | Decision | Triggers when | Notes |
|------------|----------|---------------|-------|
| `urgency-cta` | WARN | `buy now`, `act now`, `limited time`, `hurry`, `立即购买` | Never BLOCKER |
| `unsubstantiated-testimonial` | REVIEW | `clinically proven`, `doctor recommended`, `users love` | Pairs with rule superlative on sample ad |
| `before-after-imagery` | CONDITIONAL | `before and after`, `transformation`, `前后对比` | Often in OCR text |

## Invariants (Epic 2)

- Playbook findings **never** use severity `BLOCKER` or decision `FAIL`.
- Playbook does not inspect `landingUrl` (text/OCR only).
- Typical decisions (`REVIEW`, `CONDITIONAL_PASS`) are guidance for human reviewers; fusion maps non-blocker signals to `WARN` at decision layer.

## Sample ad alignment

`Clinically proven to cure diabetes in 7 days. Buy now!` → `urgency-cta` + `unsubstantiated-testimonial`

`Daily vitamins for general wellness.` → no playbook hits
