# Skill Taxonomy

**Version:** skill-taxonomy-1.0.0  
**Status:** Canonical (Sprint 3 — Knowledge Foundation)  
**Machine-readable:** [skill-taxonomy.json](./skill-taxonomy.json)

---

## Purpose

This document defines the **Skill Module taxonomy** for AAIRP Review Playbook (Skill) patterns.

Rules:

1. Every **Playbook Pattern** belongs to **exactly one** Skill Module.
2. Golden Benchmark `issue` labels map to `skill_module`, `pattern_id`, and `expected_rule` via `golden_issue_map` in the JSON file.
3. This taxonomy is authoritative for Benchmark V2 generation, linkage validation, and (Sprint 4+) evaluation and Case Library linkage.

**Runtime note:** Skill Modules are classification metadata only. They do **not** change review pipeline behavior in Sprint 3.

---

## Skill Modules

| Skill Module | Description | Pattern count |
|--------------|-------------|---------------|
| Claim Review | Product, performance, health, and comparative claims | 7 |
| Evidence Review | Certification, patent, award, laboratory evidence | 1 |
| Localization Review | Market-appropriate language and assets | 1 |
| Consistency Review | Cross-asset and SKU consistency | 0 |
| Brand/IP Review | Third-party brand and IP conflicts | 0 |
| Content Quality Review | Grammar, imagery, before/after presentation | 2 |
| AI Content Review | AI-rendered imagery and synthetic assets | 0 |
| Disclaimer Review | Disclosures, urgency CTAs, sponsored content | 2 |

---

## Playbook Pattern → Skill Module

| Pattern ID | Skill Module | Purpose |
|------------|--------------|---------|
| `unsubstantiated-testimonial` | Claim Review | Efficacy or testimonial claims requiring substantiation |
| `sa-absolute-performance` | Claim Review | Absolute or omnibus performance wording |
| `sa-health-implication` | Claim Review | Implied health or nutrition benefits |
| `sa-comparative-claim` | Claim Review | Comparative claims missing baseline |
| `sa-performance-claim` | Claim Review | Quantitative performance claims |
| `sa-comparative-superiority` | Claim Review | Superiority or beyond-standard claims |
| `sa-capacity-claim` | Claim Review | Capacity or volume claims |
| `sa-certification-evidence` | Evidence Review | Certification, patent, award, lab evidence |
| `sa-localization` | Localization Review | Wrong-market localization assets |
| `before-after-imagery` | Content Quality Review | Before/after transformation imagery |
| `sa-grammar-quality` | Content Quality Review | Grammar, spelling, time-format errors |
| `urgency-cta` | Disclaimer Review | Urgency or pressure language |
| `sa-disclaimer-required` | Disclaimer Review | Missing AI or illustration disclaimer |

**Source:** `demo/playbook.demo.md` (pack `demo-playbook-1.3.0`)

---

## Golden Issue → Skill Module (summary)

Full mapping with `expected_rule` is in [skill-taxonomy.json](./skill-taxonomy.json) under `golden_issue_map`.

| Golden `issue` | Skill Module | Pattern ID |
|----------------|--------------|------------|
| Absolute Claim | Claim Review | `sa-absolute-performance` |
| Comparative Claim | Claim Review | `sa-comparative-claim` |
| Comparative Advertising | Claim Review | `sa-comparative-superiority` |
| Performance Claim | Claim Review | `sa-performance-claim` |
| Capacity Claim | Claim Review | `sa-capacity-claim` |
| Health Claim / Medical Claim | Claim Review | `sa-health-implication` |
| Certification / Evidence / Patent | Evidence Review | `sa-certification-evidence` |
| Localization | Localization Review | `sa-localization` |
| Content Consistency / Brand Consistency | Consistency Review | *(no pattern yet)* |
| Brand / IP | Brand/IP Review | *(no pattern yet)* |
| Disclaimer | Disclaimer Review | `sa-disclaimer-required` |
| AI Disclosure | AI Content Review | `sa-disclaimer-required` |
| AI Image Quality | AI Content Review | *(no pattern yet)* |
| Grammar | Content Quality Review | `sa-grammar-quality` |
| Internal Note | Content Quality Review | *(excluded from strict linkage)* |

---

## Gaps & follow-up

| Gap | Sprint 3 handling |
|-----|-------------------|
| Consistency Review — no playbook pattern | Rule-only via `demo-apac-sa-content-consistency-blocker` |
| Brand/IP Review — no playbook pattern | Rule-only via `demo-apac-sa-wrong-sku` |
| AI Content Review — no dedicated pattern | Maps to `sa-disclaimer-required` for AI Disclosure cases |
| Internal Note issues | Excluded from strict linkage validation |

---

## Change control

Bump `taxonomy_version` (semver patch) when:

- A pattern moves between modules
- A new pattern is added to the playbook
- A golden `issue` label is added or remapped

Regenerate Benchmark V2 and Knowledge Pack manifest after any taxonomy change.
