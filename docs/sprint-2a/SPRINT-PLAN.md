# Sprint 2A — Knowledge Foundation

**Sprint ID:** 2A  
**Theme:** 知识管理基础设施（后台能力），**不**扩展审核逻辑  
**Duration:** 3 weeks (15 working days) — adjustable by team size  
**Parallel track:** Internal Pilot 关账（不阻塞本 Sprint；无 Node 环境时 Pilot 以人工台账 + CI 代跑为主）

---

## 1. Goals & non-goals

### Goals

| # | Goal |
|---|------|
| G1 | 为 Rule / Playbook / Prompt 建立 **可版本化、可审计** 的持久化与 Admin API |
| G2 | 为 Review History / Feedback 建立 **存储与查询** 能力，支撑 Pilot 与后续 2B |
| G3 | 全链路 Admin 操作写入 **Append-only Audit Log** |
| G4 | 从 Sprint 1 Demo 资产 **一次性导入** 种子数据，便于 Admin 联调 |

### Non-goals (Sprint 2B+)

- 修改 `ReviewPipelineService` / Rule·Playbook·LLM **评估逻辑**
- Knowledge Gateway **运行时** 从 DB 加载规则（Happy Path 仍用硬编码 + demo 文件）
- 新增国家/品类规则、Prompt 调优、真实 LLM
- 前端 UI（本 Sprint 仅 Admin API + 脚本/Postman）
- Auth / 多租户 / `/v1/reviews` 异步链路

---

## 2. Hard constraints (Must)

| ID | Constraint | Verification |
|----|------------|--------------|
| C1 | **不修改** `ReviewHappyPathService` / `ReviewPipelineService` 行为 | `pnpm test` + benchmark regression 无 diff |
| C2 | **不影响** `POST /demo/review` 响应与决策 | Live smoke + `sg-health-reject-cure` 仍 REJECT |
| C3 | **不新增** Rule/Playbook/LLM 命中逻辑 | Rule engine 代码行数不增（仅 infra 层） |
| C4 | **兼容** Sprint 1 MVP Demo | 现有 `/demo/*` 路由、DTO、demo 文件路径不变 |
| C5 | Admin 与 Demo **路由隔离** | 新路由前缀 `/admin/*`（或 `/v1/admin/*`），不替换 `/demo/*` |

---

## 3. Architecture snapshot

```
                    ┌─────────────────────────────────────┐
                    │  Sprint 1 Happy Path (UNCHANGED)     │
                    │  POST /demo/review → in-memory demo  │
                    └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  Sprint 2A — Admin / Knowledge Layer (NEW)                        │
│  POST/GET/PATCH /admin/rules|playbooks|prompts|reviews|feedback   │
│  GET /admin/audit-events                                          │
│         ↓                                                         │
│  Application services (CRUD, versioning, publish state)           │
│         ↓                                                         │
│  PG repositories (app.* + audit.* schemas)                        │
└──────────────────────────────────────────────────────────────────┘

Optional (flag OFF by default, controller-only hook):
  POST /demo/review success → ReviewRecorder.persist()  [E4-S3]
```

**Existing hooks to align with (no change in 2A runtime path):**

- `ContextBuilderService` — still `DEMO_KNOWLEDGE_VERSIONS` hardcoded
- Demo files: `demo/rules.demo.json`, `demo/playbook.demo.md`, `demo/open-risk.prompt.txt`
- DB: `app` / `audit` schemas empty since `V1.0.0__init_database.sql`

---

## 4. Estimation legend

| Unit | Meaning |
|------|---------|
| **Dev-day** | 1 developer × 1 focused day (~6h) |
| **SP** | Story Points (Fibonacci, relative) |

**Sprint 2A total (indicative):** ~**38–42 dev-days** serial → **~3 devs × 3 weeks** or **~2 devs × 4 weeks**

---

## 5. Epic breakdown

---

### Epic E0 — Knowledge Platform Foundation

**Objective:** 数据库、领域端口、Admin API 脚手架、Demo 种子导入。  
**Estimate:** 8 dev-days | **SP:** 13

| Story | Description | SP | Dev-days |
|-------|-------------|-----|----------|
| **E0-S1** | Knowledge DB migrations | 5 | 3 |
| **E0-S2** | Domain ports & shared types | 3 | 2 |
| **E0-S3** | Admin API scaffold | 3 | 2 |
| **E0-S4** | Demo knowledge seed CLI | 2 | 1 |

#### E0-S1 — Knowledge DB migrations

| Task | Estimate | Owner |
|------|----------|-------|
| T1.1 设计 ER：`rule_pack`, `rule`, `rule_version`, `playbook_pack`, `playbook_pattern`, `prompt_pack`, `prompt_template`, `prompt_version` | 0.5d | Backend |
| T1.2 设计 ER：`review_run`, `review_finding_ref`, `feedback`, `audit_event` | 0.5d | Backend |
| T1.3 编写 `V2.0.0__knowledge_tables.sql`（`app` schema） | 1d | Backend |
| T1.4 编写 `V2.0.0__audit_events.sql`（`audit` schema, append-only） | 0.5d | Backend |
| T1.5 索引：tenant+country+category、version status、created_at | 0.5d | Backend |

**Definition of Done (DoD):**

- [ ] Migrations apply cleanly on fresh DB + upgrade from V1.0.0
- [ ] `aairp_app` / `aairp_readonly` grants documented
- [ ] Rollback script or down-migration note in migration README
- [ ] CI job step: migrate + smoke query (optional if no PG in CI, document local gate)

#### E0-S2 — Domain ports & shared types

| Task | Estimate | Owner |
|------|----------|-------|
| T2.1 `packages/domain` — entities: Rule, Playbook, Prompt, ReviewRun, Feedback, AuditEvent | 1d | Backend |
| T2.2 Repository ports: `IRuleRepository`, `IPlaybookRepository`, `IPromptRepository`, `IReviewHistoryRepository`, `IFeedbackRepository`, `IAuditLogRepository` | 0.5d | Backend |
| T2.3 Version lifecycle enums: `DRAFT` / `PUBLISHED` / `ARCHIVED` | 0.25d | Backend |
| T2.4 `packages/infrastructure` — PG repository skeletons + mappers | 0.25d | Backend |

**DoD:**

- [ ] No imports from `apps/api` into domain
- [ ] Unit tests for entity validation / state transitions
- [ ] Types exported via `@aairp/domain` / `@aairp/shared-kernel` as appropriate

#### E0-S3 — Admin API scaffold

| Task | Estimate | Owner |
|------|----------|-------|
| T3.1 Fastify plugin `adminRoutes` registered **alongside** demo routes in `app.ts` | 0.25d | Backend |
| T3.2 Shared pagination / filter query validation (`limit`, `cursor`, `status`) | 0.5d | Backend |
| T3.3 Problem+JSON error envelope reuse (`@aairp/shared-kernel`) | 0.25d | Backend |
| T3.4 `AuditLogInterceptor` — wraps admin write handlers | 0.5d | Backend |
| T3.5 `scripts/admin-smoke.ps1` — health + list endpoints | 0.5d | Backend |

**DoD:**

- [ ] `/admin/health` returns 200
- [ ] Invalid admin payload → 400 Problem+JSON
- [ ] **Zero changes** to existing demo controller tests (all still pass)
- [ ] OpenAPI or `docs/sprint-2a/admin-api.md` route list published

#### E0-S4 — Demo knowledge seed CLI

| Task | Estimate | Owner |
|------|----------|-------|
| T4.1 `pnpm seed:demo-knowledge` — import `demo/rules.demo.json` → DB as PUBLISHED v1 | 0.5d | Backend |
| T4.2 Import `demo/playbook.demo.md` patterns → playbook_pack | 0.25d | Backend |
| T4.3 Import `demo/open-risk.prompt.txt` → prompt_version | 0.25d | Backend |

**DoD:**

- [ ] Idempotent seed (re-run safe)
- [ ] Seed does **not** alter in-memory demo engine behavior
- [ ] Documented in `docs/sprint-2a/README.md`

---

### Epic E1 — Rule Management

**Objective:** Rule Pack / Rule / Version 的后台 CRUD 与发布生命周期。  
**Estimate:** 6 dev-days | **SP:** 8

| Story | Description | SP | Dev-days |
|-------|-------------|-----|----------|
| **E1-S1** | Rule pack & rule CRUD | 3 | 2 |
| **E1-S2** | Rule version lifecycle | 3 | 2 |
| **E1-S3** | Scope & metadata management | 2 | 2 |

#### E1-S1 — Rule pack & rule CRUD

| Task | Estimate |
|------|----------|
| T1.1 `POST/GET /admin/rule-packs` | 0.5d |
| T1.2 `POST/GET/PATCH /admin/rules` (belongs to pack) | 0.5d |
| T1.3 Validation: rule_id unique per pack, severity/decision enums | 0.5d |
| T1.4 Repository integration tests (PG testcontainer or docker) | 0.5d |

**DoD:**

- [ ] Create/list/get/update rule pack and rule via API
- [ ] Audit event on create/update
- [ ] Admin list supports filter by `country_id`, `category_id`, `status`

#### E1-S2 — Rule version lifecycle

| Task | Estimate |
|------|----------|
| T2.1 `POST /admin/rules/:id/versions` — create DRAFT from prior or blank | 0.5d |
| T2.2 `POST .../versions/:vid/publish` — single PUBLISHED per rule; prior → ARCHIVED | 0.5d |
| T2.3 `GET .../versions/:vid` — full payload (pattern, terms, scope JSON) | 0.5d |
| T2.4 State machine unit tests (illegal publish transitions rejected) | 0.5d |

**DoD:**

- [ ] Only one PUBLISHED version per rule at a time
- [ ] Publish writes audit event with before/after version ids
- [ ] Version payload schema documented (matches demo rule shape, not new eval fields)

#### E1-S3 — Scope & metadata management

| Task | Estimate |
|------|----------|
| T3.1 Scope fields: `countries[]`, `categories[]` on rule version | 0.5d |
| T3.2 Metadata: `summary`, `tags`, `owner`, `effective_from` | 0.5d |
| T3.3 `GET /admin/rules/:id/versions?status=PUBLISHED` | 0.5d |
| T3.4 Export version as JSON (download for compliance archive) | 0.5d |

**DoD:**

- [ ] Scope stored as JSONB; query filter by country+category works
- [ ] Export matches import round-trip for demo SG health rules
- [ ] **No** wiring to `RuleEngineService`

---

### Epic E2 — Playbook Management

**Objective:** Playbook Pack / Pattern 的后台管理。  
**Estimate:** 5 dev-days | **SP:** 5

| Story | Description | SP | Dev-days |
|-------|-------------|-----|----------|
| **E2-S1** | Playbook pack CRUD | 2 | 1.5 |
| **E2-S2** | Pattern CRUD & content storage | 2 | 2 |
| **E2-S3** | Version lifecycle & export | 1 | 1.5 |

#### E2-S1 — Playbook pack CRUD

| Task | Estimate |
|------|----------|
| T1.1 `POST/GET /admin/playbook-packs` | 0.5d |
| T1.2 Link pack to dimensions (default country/category optional) | 0.5d |
| T1.3 List with pagination | 0.5d |

**DoD:**

- [ ] CRUD + audit on writes
- [ ] Pack version string aligns with `playbookPackVersion` naming convention

#### E2-S2 — Pattern CRUD & content storage

| Task | Estimate |
|------|----------|
| T2.1 `POST/GET/PATCH /admin/playbook-patterns` | 0.5d |
| T2.2 Store `match_type`, `terms[]`, `ref_id`, `guidance` (demo-aligned) | 0.5d |
| T2.3 Optional markdown body field for human-readable playbook doc | 0.5d |
| T2.4 Validation: pattern ref_id unique within pack version | 0.5d |

**DoD:**

- [ ] 3 demo patterns importable and editable via API
- [ ] **No** changes to `PlaybookEngineService`

#### E2-S3 — Version lifecycle & export

| Task | Estimate |
|------|----------|
| T3.1 DRAFT/PUBLISHED/ARCHIVED for playbook pack versions | 0.5d |
| T3.2 `GET .../export` → markdown or JSON bundle | 0.5d |
| T3.3 Diff metadata: `changed_patterns_count` on publish | 0.5d |

**DoD:**

- [ ] Publish playbook pack version atomically (transaction)
- [ ] Export reproduces `demo/playbook.demo.md` structure

---

### Epic E3 — Prompt Management

**Objective:** Open Risk Prompt（及未来 prompt 类型）的版本化管理。  
**Estimate:** 4 dev-days | **SP:** 5

| Story | Description | SP | Dev-days |
|-------|-------------|-----|----------|
| **E3-S1** | Prompt pack & template CRUD | 2 | 1.5 |
| **E3-S2** | Prompt version lifecycle | 2 | 1.5 |
| **E3-S3** | Template metadata & validation | 1 | 1 |

#### E3-S1 — Prompt pack & template CRUD

| Task | Estimate |
|------|----------|
| T1.1 `POST/GET /admin/prompt-packs` | 0.5d |
| T1.2 `POST/GET /admin/prompt-templates` (`type`: `open_risk`, future extensible) | 0.5d |
| T1.3 Store `content` text + `schema_version` | 0.5d |

**DoD:**

- [ ] Demo open-risk prompt stored as PUBLISHED v1.1.0 equivalent
- [ ] Audit on all mutations

#### E3-S2 — Prompt version lifecycle

| Task | Estimate |
|------|----------|
| T2.1 Create DRAFT from copy of PUBLISHED | 0.5d |
| T2.2 Publish / archive transitions | 0.5d |
| T2.3 `GET /admin/prompt-templates/:id/versions/:vid/content` | 0.5d |

**DoD:**

- [ ] Content size limit validated (e.g. max 256KB)
- [ ] **Stub LLM** still reads file/env path — **not** DB

#### E3-S3 — Template metadata & validation

| Task | Estimate |
|------|----------|
| T3.1 Required placeholders checklist (documented, not enforced at runtime) | 0.25d |
| T3.2 Tags: `module=OPEN_RISK`, `locale`, `model_hint` | 0.25d |
| T3.3 Lint: reject empty content / invalid UTF-8 | 0.5d |

**DoD:**

- [ ] Admin validation errors are actionable in Problem+JSON
- [ ] README notes: runtime integration deferred to Sprint 2B

---

### Epic E4 — Review History

**Objective:** 持久化审核运行记录，供 Pilot 与合规追溯；**默认不改变 Demo 行为**。  
**Estimate:** 6 dev-days | **SP:** 8

| Story | Description | SP | Dev-days |
|-------|-------------|-----|----------|
| **E4-S1** | Review run schema & repository | 3 | 2 |
| **E4-S2** | Admin query APIs | 3 | 2 |
| **E4-S3** | Optional record hook (feature flag) | 2 | 2 |

#### E4-S1 — Review run schema & repository

| Task | Estimate |
|------|----------|
| T1.1 Tables: `review_run`, `review_dimension`, `review_decision`, `finding_ref` (module, ref_id, severity) | 1d |
| T1.2 Store snapshot: `content_hash`, `ad_text` (truncated), `report_html` optional blob/ref | 0.5d |
| T1.3 `IReviewHistoryRepository.save(run)` / `findById` / `search` | 0.5d |

**DoD:**

- [ ] Schema supports SG health demo review shape
- [ ] No FK to knowledge tables required (refs by string id only)

#### E4-S2 — Admin query APIs

| Task | Estimate |
|------|----------|
| T2.1 `GET /admin/reviews?country_id&category_id&decision&from&to` | 0.5d |
| T2.2 `GET /admin/reviews/:review_id` — full detail + finding refs | 0.5d |
| T2.3 `GET /admin/reviews/:review_id/report-html` (if stored) | 0.5d |
| T2.4 Export CSV for Pilot log reconciliation | 0.5d |

**DoD:**

- [ ] Pagination + filter tested
- [ ] Can manually `POST /admin/reviews` (import) for Pilot rows without demo hook

#### E4-S3 — Optional record hook (feature flag)

| Task | Estimate |
|------|----------|
| T3.1 Env `AAIRP_RECORD_REVIEWS=false` (default) | 0.25d |
| T3.2 `ReviewRecorderService` — maps `HappyPathResult` → `ReviewRun` entity | 0.75d |
| T3.3 **Only** `demo-review.controller.ts`: after pipeline success, if flag true, async persist | 0.5d |
| T3.4 Test: flag false → zero DB writes; flag true → one row per review | 0.5d |

**DoD:**

- [ ] `ReviewPipelineService` / `ReviewHappyPathService` **unchanged**
- [ ] Flag false (default): `pnpm eval:benchmark --regression` identical results
- [ ] Flag true: review appears in `GET /admin/reviews`
- [ ] Persist failure does **not** fail `/demo/review` response (log + metric only)

---

### Epic E5 — Feedback Management

**Objective:** 结构化存储 Pilot / 试用反馈，关联 review 或 case。  
**Estimate:** 4 dev-days | **SP:** 5

| Story | Description | SP | Dev-days |
|-------|-------------|-----|----------|
| **E5-S1** | Feedback entity & storage | 2 | 1.5 |
| **E5-S2** | Admin CRUD & linkage | 2 | 1.5 |
| **E5-S3** | Pilot CSV import | 1 | 1 |

#### E5-S1 — Feedback entity & storage

| Task | Estimate |
|------|----------|
| T1.1 Map `trial-feedback-template.md` fields → `feedback` table | 0.5d |
| T1.2 Optional link: `review_id`, `case_id`, `pilot_id` | 0.5d |
| T1.3 Ratings JSON: `{ decision_accuracy: 1-5, ... }` | 0.5d |

**DoD:**

- [ ] Entity validates score ranges 1–5
- [ ] Repository tests pass

#### E5-S2 — Admin CRUD & linkage

| Task | Estimate |
|------|----------|
| T2.1 `POST/GET /admin/feedback` | 0.5d |
| T2.2 `GET /admin/feedback?pilot_id&review_id` | 0.5d |
| T2.3 `PATCH /admin/feedback/:id` (status: open/ triaged/ closed) | 0.5d |

**DoD:**

- [ ] Audit on create/update
- [ ] Linked review returns 404 if review_id invalid (when review module enabled)

#### E5-S3 — Pilot CSV import

| Task | Estimate |
|------|----------|
| T3.1 `pnpm import:pilot-log` — reads `pilot/pilot-ad-log.csv` → feedback or review metadata | 0.5d |
| T3.2 Map L2 `DISAGREE_DECISION` → feedback category `GAP` | 0.25d |
| T3.3 Import report JSON output counts | 0.25d |

**DoD:**

- [ ] 9 L2 rows import without manual SQL
- [ ] Idempotent on re-import (update by case_id)

---

### Epic E6 — Audit Log

**Objective:** 所有 Admin 写操作可追溯。  
**Estimate:** 3 dev-days | **SP:** 5

| Story | Description | SP | Dev-days |
|-------|-------------|-----|----------|
| **E6-S1** | Audit event model & writer | 2 | 1.5 |
| **E6-S2** | Admin query API | 2 | 1 |
| **E6-S3** | Retention & export policy | 1 | 0.5 |

#### E6-S1 — Audit event model & writer

| Task | Estimate |
|------|----------|
| T1.1 `audit.audit_event`: `actor`, `action`, `resource_type`, `resource_id`, `payload_json`, `occurred_at` | 0.5d |
| T1.2 `AuditLogService.record()` called from E0 interceptor | 0.5d |
| T1.3 Immutable: no UPDATE/DELETE grants for `aairp_app` | 0.5d |

**DoD:**

- [ ] Every E1–E5 write generates audit row
- [ ] DB role cannot delete audit rows

#### E6-S2 — Admin query API

| Task | Estimate |
|------|----------|
| T2.1 `GET /admin/audit-events?resource_type&resource_id&from&to` | 0.5d |
| T2.2 `GET /admin/audit-events/:id` | 0.25d |
| T2.3 Pagination + max range guard (e.g. 90 days default) | 0.25d |

**DoD:**

- [ ] Query publish rule → returns CREATE + PUBLISH events
- [ ] Readonly role can query audit via `aairp_readonly`

#### E6-S3 — Retention & export policy

| Task | Estimate |
|------|----------|
| T3.1 Document retention (e.g. 365d) — no auto purge in 2A | 0.25d |
| T3.2 `GET /admin/audit-events/export?format=csv` | 0.25d |

**DoD:**

- [ ] Export suitable for compliance archive sample
- [ ] Policy doc in `docs/sprint-2a/audit-policy.md`

---

## 6. Sprint schedule (recommended)

| Week | Focus | Epics |
|------|-------|-------|
| **W1** | Foundation + Rule + Audit core | E0, E1 (S1–S2), E6 (S1) |
| **W2** | Playbook + Prompt + Audit query | E2, E3, E6 (S2–S3) |
| **W3** | Review History + Feedback + hardening | E4, E5, regression gate |

**Daily gate:** `pnpm test` + `pnpm eval:benchmark -- --regression` must stay green.

---

## 7. Sprint 2A — Exit criteria (Definition of Done)

### Engineering DoD

- [ ] All E0–E6 stories marked done with evidence links in `docs/sprint-2a/evidence/`
- [ ] `pnpm build && pnpm test` green
- [ ] `pnpm eval:benchmark -- --regression` green (**unchanged** decision outcomes)
- [ ] `scripts/smoke-test.ps1` green
- [ ] `scripts/admin-smoke.ps1` green (new)
- [ ] `POST /demo/review` + `sg-health-reject-cure` → REJECT (live or controller test)
- [ ] Demo seed + pilot CSV import scripts documented and runnable
- [ ] No changes to `RuleEngineService` / `PlaybookEngineService` / `OpenRiskDiscoveryService` eval logic

### Product DoD

- [ ] Admin API route catalog published (`docs/sprint-2a/admin-api.md`)
- [ ] Compliance can list/edit Rule·Playbook·Prompt **versions** via API (Postman collection optional)
- [ ] Review history queryable (manual import or flag-on recordings)
- [ ] Pilot feedback ingestible from CSV
- [ ] Audit trail demonstrable for one publish workflow (rule version publish)

### Pilot parallel track (non-blocking)

- [ ] Internal Pilot continues per `docs/internal-pilot/checklist.md`
- [ ] Pilot Report may complete **after** 2A code merge — does not block 2A release
- [ ] 2B scope **explicitly deferred** until Pilot Report signed

---

## 8. Sprint 2B placeholder (decision after Pilot Report)

| Candidate | Trigger from Pilot |
|-----------|-------------------|
| Knowledge Gateway runtime | Need dynamic rule packs without redeploy |
| 新马泰小家电 WARN rules | L2 GAP: absolute / health / comparative |
| Real LLM provider | Qualitative feedback on Open Risk usefulness |
| Admin UI | Reviewer demand for non-API workflow |
| Auth + `/v1/reviews` | External integration readiness |

---

## 9. Risk register

| Risk | Mitigation |
|------|------------|
| E4 hook accidentally changes demo latency | Async fire-and-forget; flag default off |
| Schema churn breaks future 2B gateway | Version payloads mirror demo JSON shape |
| No Node locally | CI runs test + regression; dev uses Docker PG |
| Scope creep into review logic | PR label `sprint-2a`; reject changes in `*-engine.service.ts` |
| Pilot delays 2B decision | 2A still ships; 2B backlog groomed from `pilot-ad-log.csv` GAPs |

---

## 10. Summary table

| Epic | Stories | Dev-days | SP |
|------|---------|----------|-----|
| E0 Foundation | 4 | 8 | 13 |
| E1 Rule Management | 3 | 6 | 8 |
| E2 Playbook Management | 3 | 5 | 5 |
| E3 Prompt Management | 3 | 4 | 5 |
| E4 Review History | 3 | 6 | 8 |
| E5 Feedback Management | 3 | 4 | 5 |
| E6 Audit Log | 3 | 3 | 5 |
| **Total** | **22** | **~36** | **49** |

---

**Sign-off (Sprint kickoff):**

| Role | Name | Date |
|------|------|------|
| PO | | |
| Tech Lead | | |
| Compliance | | |
