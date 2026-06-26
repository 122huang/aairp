# Regulation — KOS object (E1)

Types: `@aairp/shared-kernel` → `knowledge/regulation.ts`  
Tables: `app.regulation`, `app.regulation_version`, `app.rule_version_regulation`

| Column | Purpose |
|--------|---------|
| `regulation_key` | Stable id e.g. `sg-hpa-s7` |
| `jurisdiction` | SG, MY, TH, … |
| `law_name` / `article` | Citation |
| `search_text` | Optional full-text helper |

API: `/kos/v1/regulations` (E1 ✅)
