# Skill Corpus

**Corpus type:** `skill`  
**Schema:** [skill-corpus-entry.schema.json](./skill-corpus/schemas/skill-corpus-entry.schema.json)  
**Status:** Sprint 5B-1 — Advertising Review foundation  
**Related:** [KNOWLEDGE-ROADMAP-v1.0.md](./KNOWLEDGE-ROADMAP-v1.0.md) · [KNOWLEDGE-AUTHORING-STANDARD.md](./KNOWLEDGE-AUTHORING-STANDARD.md)

---

## Purpose

The Skill Corpus defines **review capabilities and execution guidance** for advertising compliance review. Skill entries answer: *How should we review this claim type?*

**Important:** Skill entries do **not** encode regulatory decision logic. Binding decisions (REJECT / REVIEW / WARN) remain owned by the **Rule Corpus** and runtime rule engine. Skills guide *what to inspect*, *what to check*, and *when to escalate to rules*.

---

## Entry model

One JSON file per **atomic skill** under `skill-corpus/skills/`.

| Field | Role |
|-------|------|
| `skill_id` | Stable slug; suffix of `knowledge_id` |
| `skill_purpose` | Why this skill exists |
| `skill_status` | Lifecycle: `draft` · `validated` · `production` · `deprecated` |
| `skill_version` | Semver for the skill contract |
| `input_definition` | Modalities, countries, categories, claim types |
| `detection_patterns[]` | Signals and playbook cross-refs (references, not hard deps) |
| `skill_behavior` | Checkpoint actions and escalation hints (not decisions) |
| `output_schema` | Expected review output fields |
| `review_guidance` | TRIGGER / ACTION / CHECK / ESCALATE IF reviewer guidance |
| `linkage` | Cross-corpus links (regulations, rules, benchmarks, rewrites) |

### Lifecycle (`skill_status`)

| Status | Regulation linkage | Use |
|--------|-------------------|-----|
| `draft` | Recommended | Work in progress |
| `validated` | **Required** (or `regulation_scope: independent`) | Reviewed, not yet released |
| `production` | **Required** (or `regulation_scope: independent`) | Active knowledge asset |
| `deprecated` | N/A | Retained for audit; excluded from coverage numerators |

Regulation-independent skills require explicit opt-out:

```json
{
  "regulation_scope": "independent",
  "regulation_independence_rationale": "Internal copy-quality checks with no regulatory claim class."
}
```

### Legacy bridge

`legacy_skill_module` and `legacy_pattern_ids` map to `skill-modules.json` for eval and drift reporting. **Do not delete or migrate** `skill-modules.json` without an approved sprint.

---

## Linkage rules

| Target | Format | Validation |
|--------|--------|------------|
| Regulations | `regulation:{id}` | Error if unknown |
| Rules | `demo-*` rule IDs | Error if unknown |
| Benchmarks | `case_id` from benchmark-v3 | Error if unknown |
| Rewrites | `rewrite:{template_id}` | **Error** if unknown (Rewrite Corpus registered) |
| Playbook patterns | `playbook_pattern_id` on patterns | **Warning only** |

Active skills (`validated`, `production`) **must** link to ≥1 regulation `knowledge_id` unless `regulation_scope: independent`.

---

## Foundation skills (5B-1)

| skill_id | Claim type | Legacy module |
|----------|------------|---------------|
| `health-claim-review` | health-claim | Claim Review |
| `superlative-claim-review` | superlative-claim | Claim Review |
| `comparative-claim-review` | comparative-claim | Claim Review |
| `certification-claim-review` | certification-claim | Evidence Review |
| `performance-claim-review` | performance-claim | Claim Review |

---

## Commands

```bash
pnpm knowledge:build-skill-corpus-index
pnpm knowledge:validate-skill-corpus
pnpm knowledge:skill-corpus-coverage-report
pnpm knowledge:skill-corpus-dashboard
pnpm knowledge:skill-corpus-drift-report
pnpm knowledge:platform-dashboard
```

---

## Authoring checklist

- [ ] `knowledge_id` matches `skill:{skill_id}`
- [ ] `skill_status` and `skill_version` set
- [ ] `review_guidance` uses TRIGGER / ACTION / CHECK / ESCALATE IF
- [ ] `skill_behavior.checkpoint_actions` has ≥2 items
- [ ] `linkage.regulations` has ≥1 ID for active skills
- [ ] `linkage.rules` references valid demo rules
- [ ] `legacy_skill_module` and `legacy_pattern_ids` set for drift bridge
- [ ] No regulatory decision logic in skill entry (rules own decisions)
