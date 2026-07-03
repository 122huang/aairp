# Ad Compliance Hub — Sprint 1 Happy Path Demo

Advertising AI Review Platform 的 **Sprint 1 Happy Path** 实现：一条同步请求完成广告上传、规则/Playbook/LLM 审核、决策融合与 HTML 报告生成。

**主入口：** `POST /demo/review`

---

## RC1-Demo v1（用户演示）

**入口：** http://localhost:3000/demo-ui/ · 文档：[docs/rc1-demo/README.md](docs/rc1-demo/README.md)

**Legal Pilot（英文法务）：** [docs/legal-pilot/README.md](docs/legal-pilot/README.md) · 范围：[PILOT-SCOPE.md](docs/legal-pilot/PILOT-SCOPE.md)

**法务内测版（中文 UI）：** [docs/legal-pilot/内测说明.md](docs/legal-pilot/内测说明.md) · 用户端 `/review/` · 管理端 `/admin-ui/` · 启动：`.\scripts\start-legal-pilot.ps1`

```powershell
pnpm seed:rc1-cases    # 可选：预置 5 条 Case
pnpm dev:api
# 或 .\scripts\start-rc1-demo.ps1
```

---

## Sprint 1.5 — 快速启动（Epic 1 环境稳定）

| 步骤 | 命令 |
|------|------|
| 1. 安装依赖 | Node ≥ 20 + [pnpm](https://pnpm.io/installation) |
| 2. 复制环境变量 | `copy .env.example .env` |
| 3. 启动 PG + Redis | `.\scripts\start-deps.ps1` |
| 4. 安装 & 测试 | `pnpm install && pnpm build && pnpm test` |
| 5. 启动 API | `.\scripts\start-dev.ps1` 或 `pnpm dev:api` |
| 6. Smoke (offline) | `.\scripts\smoke-test.ps1` |
| 7. Release gate | `.\scripts\release-gate.ps1 -SkipLive` |
| 8. Benchmark eval | `pnpm eval:benchmark` |
| 9. Dataset eval | `pnpm eval:dataset` |
| 10. Single-case demo | `.\scripts\demo-review.ps1 -Case sg-health-reject-cure` |

验证：

```powershell
curl.exe http://localhost:3000/health
curl.exe http://localhost:3000/ready
```

CI：推送至 `main`/`master` 时 GitHub Actions 执行 `pnpm build && pnpm test && pnpm eval:benchmark --regression`。

---

## MVP 试用指南

**Internal Pilot 关账（Sprint 1.5 → Sprint 2）：** 见 [docs/internal-pilot/README.md](docs/internal-pilot/README.md)，一键执行 `.\scripts\pilot-closeout.ps1`。

**Sprint 2A（Knowledge Operating System）：** 见 [docs/sprint-2a/SPRINT-2A-KOS-ROADMAP.md](docs/sprint-2a/SPRINT-2A-KOS-ROADMAP.md) — KOS 运营层（Regulation / Rule / Playbook / Prompt / Case / Feedback / Audit），不修改 Happy Path。

内部试点（Pilot）推荐流程：

1. 阅读 [docs/known-issues.md](docs/known-issues.md)（Stub LLM、仅 SG health 自动规则等）
2. 按 [docs/deployment-checklist.md](docs/deployment-checklist.md) 部署
3. 运行 `.\scripts\pilot-closeout.ps1`（或 `.\scripts\release-gate.ps1 -SkipLive` 若 API 未起）
4. 启动 API 后：`.\scripts\pilot-review.ps1 -All -OutputJson pilot\results\l2-run.json`
5. 填写 [pilot/pilot-ad-log.csv](pilot/pilot-ad-log.csv) 与 [docs/internal-pilot/pilot-report-template.md](docs/internal-pilot/pilot-report-template.md)
6. 2–3 位评审填写 [docs/trial-feedback-template.md](docs/trial-feedback-template.md)

**推荐首批试点 case：**

| case_id | 预期 |
|---------|------|
| `sg-health-reject-cure` | REJECT（Rule BLOCKER） |
| `sg-food-pass-disclosed` | PASS |
| `my-cosmetic-warn-claims` | PASS（引擎）/ intent WARN（人工） |

---

## 当前状态（2026-06-26）

| 项 | 状态 | 说明 |
|----|------|------|
| Happy Path 代码（T1–T8） | ✅ 已完成 | `POST /demo/review` 全链路已实现 |
| Sprint 1.5 Epic 1（稳定化） | ✅ 代码完成 | env/compose、统一校验、pipeline 日志、LLM 超时重试、编排去重 |
| Sprint 1.5 Epic 2（审核质量） | ✅ 代码完成 | Prompt/Rule/Playbook/Report 提质；词边界修复；quality-scenarios |
| Sprint 1.5 Epic 3（评估框架） | ✅ 代码完成 | benchmark manifest、eval runner、metrics 报告、regression 测试 |
| Sprint 1.5 Epic 4（Demo 数据集） | ✅ 代码完成 | 8 国 × 4 品类 32 条；`pnpm eval:dataset`；`demo-review.ps1` |
| Sprint 1.5 Epic 5（Bug 管理） | ✅ 代码完成 | bug-backlog、technical-debt、GitHub bug 模板 |
| Sprint 1.5 Epic 6（发布就绪） | ✅ 代码完成 | release/deployment checklist、smoke/release-gate、试用反馈模板 |
| T11 / MVP 试用 | ⏸ **待执行** | 环境就绪后：`release-gate.ps1` + [MVP 试用指南](#mvp-试用指南) |

---

## 前置条件

| 依赖 | 版本 / 说明 |
|------|-------------|
| Node.js | ≥ 20 |
| pnpm | 最新稳定版 |
| PostgreSQL | 用于 `/ready` 探针（Happy Path 业务数据在内存中） |
| Redis | 用于 `/ready` 探针 |

安装 Node 与 pnpm 后，在项目根目录执行：

```powershell
pnpm install
pnpm build
```

---

## 启动 API

在项目根目录设置环境变量并启动（默认端口 **3000**）：

```powershell
cd C:\Users\ShujieHuang\aairp

$env:DATABASE_URL = "postgresql://USER:PASSWORD@localhost:5432/aairp"
$env:REDIS_URL    = "redis://localhost:6379"

pnpm dev:api
```

确认服务可用：

```powershell
curl.exe http://localhost:3000/health
curl.exe http://localhost:3000/ready
```

`/health` 应返回 200。`/ready` 需 PostgreSQL 与 Redis 可达；若依赖未就绪会返回 503（不影响下文 `/demo/*` 路由注册，但需 API 进程已成功启动）。

---

## T11 验收清单

在 API 已启动、当前目录为项目根目录的前提下，逐项执行。

| # | 检查项 | 命令 / 操作 | 预期 |
|---|--------|-------------|------|
| 1 | 全链路 Happy Path | 见下方 **验收 A** | HTTP **200** |
| 2 | 响应含 decision + findings + report | 检查 JSON 字段 | 见 **预期响应** |
| 3 | HTML 可打开 | 见下方 **查看 report_html** | 浏览器可见 decision 与 findings 表格 |
| 4 | Rule 真实生效 | 验收 A 使用含 `cure` 的样例广告 | `final_decision` 为 **REJECT** |
| 5 | 单元测试 | `pnpm test` | 全部通过（本地执行） |

---

## 验收 A — Sample Ad → REJECT（主路径）

使用仓库内 Demo 样例：`demo/sample-ad-upload.json`（含禁词 `cure`，触发 Rule BLOCKER）。

**curl（Windows 推荐 `curl.exe`）：**

```powershell
curl.exe -X POST http://localhost:3000/demo/review `
  -H "Content-Type: application/json" `
  -d "@demo/sample-ad-upload.json"
```

**PowerShell 替代写法：**

```powershell
$body = Get-Content -Raw -Path "demo/sample-ad-upload.json"
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/demo/review" `
  -ContentType "application/json" -Body $body
```

**预期（关键字段）：**

```json
{
  "final_decision": "REJECT",
  "confidence": 1,
  "finding_counts": { "rule": 1, "playbook": 1, "llm": 0 },
  "summary": {
    "open_risk_skipped": true,
    "open_risk_skip_reason": "HAS_BLOCKER",
    "findings": [ "..." ]
  },
  "report_html": "<!DOCTYPE html>..."
}
```

- `summary.findings` 非空（至少含 Rule / Playbook 命中）
- BLOCKER 存在时 Open Risk 被跳过（`llm` 计数为 0）

---

## 验收 B — 合规广告 → PASS

```powershell
curl.exe -X POST http://localhost:3000/demo/review `
  -H "Content-Type: application/json" `
  -d "{\"country_id\":\"SG\",\"platform_id\":\"META\",\"category_id\":\"health.supplement\",\"content\":{\"text\":\"Daily vitamins for general wellness. #ad\"}}"
```

**预期：**

```json
{
  "final_decision": "PASS",
  "confidence": 0.95,
  "finding_counts": { "rule": 0, "playbook": 0, "llm": 0 }
}
```

> 无 `#ad` 时在 SG health 下可能为 **WARN**（disclosure 规则）。试点 PASS 样例请用 dataset `sg-food-pass-disclosed` 或上文带 `#ad` 的请求。

---

## 查看 report_html

将响应中的 HTML 保存为文件并在浏览器打开：

```powershell
# 使用 curl 保存完整响应
curl.exe -X POST http://localhost:3000/demo/review `
  -H "Content-Type: application/json" `
  -d "@demo/sample-ad-upload.json" `
  -o demo/review-response.json

# 提取 report_html 并写入 .html 文件（需 Node）
node -e "const r=require('./demo/review-response.json'); require('fs').writeFileSync('demo/review-report.html', r.report_html)"
start demo/review-report.html
```

浏览器中应看到：

- **Decision** 色块：`REJECT` / `WARN` / `PASS`
- **Rule / Playbook / LLM** 分节 findings 表格
- **Rationale** 含 top finding 摘要

---

## 增量调试端点（可选）

Happy Path 各模块亦可单独调用（需先 `POST /demo/advertisements` 取得 `advertisement_id`）：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/demo/advertisements` | 仅上传 |
| POST | `/demo/review-context` | Context |
| POST | `/demo/rule-evaluation` | Rule Engine |
| POST | `/demo/playbook-evaluation` | Playbook |
| POST | `/demo/open-risk-discovery` | Open Risk |
| POST | `/demo/decision` | Decision |
| POST | `/demo/review-report` | Report |
| POST | `/demo/review` | **全链路（推荐 Demo 入口）** |

---

## Demo 资产

| 路径 | 用途 |
|------|------|
| `demo/dataset/` | **32 条** 国别/品类试点广告（见 `index.json`） |
| `demo/sample-ad-upload.json` | T11 兼容请求体（同 `sg-health-reject-cure`） |
| `benchmark/ad-manifest.json` | SG health 回归 benchmark |
| `demo/rules.demo.json` | Rule 参考配置 |
| `demo/playbook.demo.md` | Playbook 模式 |
| `demo/open-risk.prompt.txt` | LLM Prompt 模板 |
| `demo/open-risk.stub.json` | Stub LLM 响应 |

## 文档（Sprint 1.5）

| 文档 | 用途 |
|------|------|
| [docs/release-checklist.md](docs/release-checklist.md) | 发布签字清单 |
| [docs/deployment-checklist.md](docs/deployment-checklist.md) | 部署步骤 |
| [docs/known-issues.md](docs/known-issues.md) | 试点已知限制 |
| [docs/bug-backlog.md](docs/bug-backlog.md) | Bug 台账 |
| [docs/technical-debt.md](docs/technical-debt.md) | 技术债 |
| [docs/trial-feedback-template.md](docs/trial-feedback-template.md) | 试点反馈表 |

---

## 测试与发布门禁

```powershell
pnpm test                      # 含 benchmark-regression + dataset 单测
.\scripts\smoke-test.ps1         # build + test + eval regression + dataset auto
.\scripts\release-gate.ps1 -SkipLive   # 离线发布门禁
.\scripts\smoke-test-live.ps1    # 需 API：health + REJECT + PASS
```

---

## 范围说明（Sprint 1）

**已包含：** Upload → Context → Rule → Playbook → Open Risk → Decision → Report → `POST /demo/review`

**未包含：** `/v1/reviews` 异步、鉴权、业务库持久化、Policy/Case、Evidence 完整组装、CI/Docker

---

## 后续规划（已文档化，尚未排期执行）

以下为产品/Backlog 中 **已有规划**、但 **Happy Path 阶段尚未启动** 的方向，供接 Sprint 时参考。

### A. Happy Path 收尾（环境就绪后优先）

| 步骤 | 内容 |
|------|------|
| 1 | 安装 Node ≥20 + pnpm |
| 2 | 配置 PostgreSQL / Redis，启动 `pnpm dev:api` |
| 3 | 执行 [T11 验收清单](#t11-验收清单)（curl + 打开 `report_html`） |
| 4 | `pnpm test` 全绿 |
| 5 | （可选）编排去重：增量 `/demo/*` Controller 委托 `ReviewHappyPathService` |

### B. 正式 Sprint 计划（见 `Advertising-AI-Review-Platform-Sprint-Plan.md`）

Happy Path 相当于在 monorepo 内 **提前打通了一条纵向 Demo 链**；与 Backlog 中按 Epic 推进的路线 **并行但不等同**。按 Release Train，后续大致为：

| 阶段 | Sprint / 里程碑 | 重点 |
|------|-----------------|------|
| **M0 Foundation** | Sprint 1–4 | 工程骨架、CI、`docker compose`、维度主数据、知识/Case 表 migration |
| **M1 Knowledge Core** | Sprint 5–7 | Rule DSL 生产化、Policy Engine、Playbook 生产匹配 |
| **M2 Experience** | Sprint 8–10 | Case Memory、Review Intelligence、LLM 生产 Guardrail |
| **M3 Intelligence / E2E** | Sprint 11–13 | Decision/Evidence 完整化、Workflow 编排、`/v1/reviews` 对外 API |
| **M6 Go-Live** | Sprint 14 | 安全、E2E、上线 |

**说明：** 当前代码中 Rule/Playbook/LLM 多为 **Demo 硬编码 + 内存存储**；接下去若进入 Sprint 2+，通常从 **E1 数据模型持久化**、**E2 Knowledge Gateway** 或 **E0 CI/compose** 择一作为下一个 Story，需 Tech Lead 确认优先级。

### C. 尚未在 Happy Path 中规划的具体 Story

- Policy Engine、Case Memory、真实 LLM Provider  
- `ReviewResult` / Evidence 落库  
- 异步 Worker、`/v1/reviews`、鉴权与多租户  
- Learning / Simulation / Canary（MVP 已排除）

**下一步由你确认：** 环境补齐后先 **关闭 T11 验收**，还是直接 **开 Sprint 2（维度主数据 / migration）**。
