# Demo Rules — Expected Hit Scenarios (Sprint 1.5 Epic 2)

Reference asset: `demo/rules.demo.json`  
Runtime: `RuleEngineService` (3 rules, SG + health.supplement scope)

| Rule ID | Severity | Triggers when | Must NOT trigger |
|---------|----------|---------------|------------------|
| `demo-sg-health-forbidden-claim` | BLOCKER | Whole-word match: `cure`, `miracle`, `100% cure`, `100% effective` | Substring inside other words (e.g. **secure**), out-of-scope country/category |
| `demo-sg-health-superlative` | MEDIUM WARN | `clinically proven`, `guaranteed`, `100%`, `instant results` | Clean wellness copy without superlatives |
| `demo-sg-sponsored-disclosure` | LOW WARN | No disclosure token in text/OCR | Text contains `#ad`, `sponsored`, `advertisement`, or `广告` |

## Sample expectations

| Ad text | Expected rule hits |
|---------|-------------------|
| `Clinically proven to cure diabetes…` | forbidden-claim + superlative + disclosure |
| `Daily vitamins. #ad` | *(none)* |
| `Secure checkout for supplements. #ad` | *(none — no false cure hit)* |
| `Daily vitamins.` (no disclosure) | sponsored-disclosure only |

Word-boundary matching is enforced in `content-matching.ts` to reduce false positives.
