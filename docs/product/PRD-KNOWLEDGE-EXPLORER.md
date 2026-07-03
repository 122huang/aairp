# PRD — Knowledge Graph Explorer

## User

- Product / legal stakeholder — wants to understand why AAIRP is more than an LLM wrapper
- Knowledge engineer — validates linkage between corpora

## Problem

Linkage between Regulation → Skill → Evidence → Rewrite → Case exists in corpus adapters but is not visible. Stakeholders cannot explore how review capabilities connect to governed knowledge.

## Use case

As a product owner, I select **Health Claim Review** in the Graph Explorer and see linked regulations, demo rules, required evidence, rewrite guidance, and validation cases in a skill-centric tree — for human understanding, not graph analytics.

## Acceptance criteria

- [ ] Explorer reads graph data from visibility snapshot (embedded `graph` section)
- [ ] Primary navigation axis is **Skill**
- [ ] Secondary filter by claim type
- [ ] Layered HTML/CSS tree layout (no Cytoscape, D3, or graph DB)
- [ ] Node detail panel shows summary and metadata (country, requirement level, benchmark ref)
- [ ] Evidence nodes attach to skill branches (orthogonality preserved in layout)
- [ ] EN-first labels from corpus content; minimal zh-Hans chrome only in navigation

## Screenshots / demo notes

- Tab: **Graph Explorer** on `/knowledge/`
- Select different skills from dropdown to show varying linkage depth
- Click nodes to populate detail panel on the right
- Demo skill with rich linkage: Health Claim Review or Performance Claim Review
