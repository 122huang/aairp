# AAIRP Core Review Package

**Purpose:** External review of prompt, API flow, and decision rules.  
**Generated:** 2026-07-02  
**Knowledge versions:** `demo-rule-1.6.12` · `demo-playbook-1.5.7` · `demo-open-risk-1.3.0`

## Files in this folder

| File | Role |
|------|------|
| `INDEX.md` | This index |
| `open-risk.prompt.txt` | Open Risk LLM prompt template |
| `open-risk.stub.json` | Stub LLM response used when Open Risk is not live |
| `rules.demo.json` | Rule engine definitions (28 rules, keyword lists, severity) |
| `playbook.demo.md` | Playbook patterns (27 patterns, guidance) |
| `demo-review.controller.ts` | HTTP `POST /demo/review` entry |
| `demo-review.dto.ts` | Maps happy-path result to API JSON (`toDemoReviewResponseDto`) |
| `review-happy-path.service.ts` | Upload → context → pipeline |
| `review-pipeline.service.ts` | Rule → Playbook → Open Risk → Decision → Report |
| `open-risk-llm.gateway.ts` | LLM provider routing (stub / live) |
| `open-risk-discovery.service.ts` | Prompt render + guardrails |
| `open-risk-response.parser.ts` | Parses Open Risk LLM JSON into findings |
| `decision-engine.service.ts` | Final PASS / WARN / REJECT fusion |
| `rule-engine.service.ts` | Deterministic keyword rule matching |
| `playbook-engine.service.ts` | Playbook pattern matching |
| `content-matching.ts` | Term boundary + substring matching |
| `sample-outputs.json` | PASS / WARN / REJECT sample `POST /demo/review` responses |

## Pipeline (frozen)

```
POST /demo/review
  → AdvertisementUploadService
  → ContextBuilderService
  → RuleEngine → PlaybookEngine → OpenRiskDiscovery → DecisionEngine → Report
```

## Decision rules (summary)

- **REJECT:** any Rule finding with `severity=BLOCKER` and `decision=FAIL` (`hasBlocker`)
- **WARN:** any Rule WARN, Playbook finding, or Open Risk finding (no blocker)
- **PASS:** zero findings across all modules
- Open Risk **cannot REJECT alone**; skipped when `HAS_BLOCKER`

## Env (Open Risk live)

```env
AAIRP_OPEN_RISK_MODE=live
OPEN_RISK_LLM_PROVIDER=deepseek|anthropic|openai
DEEPSEEK_API_KEY=...
```
