# Sprint 2A — Knowledge Operating System (KOS)

**Status:** In Progress  
**Master roadmap:** [SPRINT-2A-KOS-ROADMAP.md](./SPRINT-2A-KOS-ROADMAP.md)

Sprint 2A 建设 **Knowledge Operating System（KOS）**，不是传统后台开发。

## KOS 管理对象（7）

Regulation · Rule · Playbook · Prompt · Case · Feedback · Audit Log

## 统一能力（每类对象）

查询 · 编辑 · 版本管理 · 发布 · 回滚 · 搜索 · 审计

## API 前缀（目标）

`/kos/v1/*`（与 `/demo/*` 审核链路隔离）

## 硬约束

- 不新增审核能力
- 不修改 Happy Path / Decision Engine
- 不开发 Learning / Agent

## 已开工代码（rebase 到 E0/E2/E5）

- **E0-S2 ✅** `pnpm migrate` / `scripts/migrate.ps1` + V2 KOS schema（含 Regulation、Case）
- **E0-S3 ✅** `/kos/v1` gateway + `GET /kos/v1/health` + pagination helpers
- **E0-S4 ✅** `GET /kos/v1/search` (Rule PG + Case JSON fallback)
- **E0-S5 ✅** `KosPublishService` publish/rollback + `POST /kos/v1/publish|rollback`
- **E0-S6 ✅** `pnpm kos:import-demo` — demo rules/playbook/prompt/regulations → KOS PUBLISHED
- **E1 ✅** Regulation CRUD + search + export (`/kos/v1/regulations`)
- **E2 ✅** Rule KOS API (`/kos/v1/rule-packs`, `/rules`) + export + regulation links
- `packages/infrastructure/src/knowledge/*` PG repositories
- `packages/application/src/knowledge/*` partial services
- `case-library/` + Case Auto Save

## 文档

| Doc | Purpose |
|-----|---------|
| [SPRINT-2A-KOS-ROADMAP.md](./SPRINT-2A-KOS-ROADMAP.md) | Epic → Story → Task → Dependency → DoD |
| [evidence/e0-s2-completion-report.md](./evidence/e0-s2-completion-report.md) | E0-S2 完成报告 |
| [evidence/e0-s3-completion-report.md](./evidence/e0-s3-completion-report.md) | E0-S3 完成报告 |
| [evidence/e0-s4-completion-report.md](./evidence/e0-s4-completion-report.md) | E0-S4 完成报告 |
| [evidence/e0-s5-completion-report.md](./evidence/e0-s5-completion-report.md) | E0-S5 完成报告 |
| [evidence/e0-s6-completion-report.md](./evidence/e0-s6-completion-report.md) | E0-S6 完成报告 |
| [evidence/e1-completion-report.md](./evidence/e1-completion-report.md) | E1 Regulation 完成报告 |
| [evidence/e2-completion-report.md](./evidence/e2-completion-report.md) | E2 Rule 完成报告 |
| [kos-api.md](./kos-api.md) | `/kos/v1` 路由目录 |
| [kos-regulation-schema.md](./kos-regulation-schema.md) | Regulation 表说明 |
| [SPRINT-PLAN.md](./SPRINT-PLAN.md) | ⚠ superseded |

## Legacy

原「Admin 后台管理」计划见 `SPRINT-PLAN.md`；自 2026-06-26 起以 KOS Roadmap 为准。
