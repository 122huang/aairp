# 项目拍板记录 — 2026-08-04

**来源**：产品 / 架构 / 项目负责人综合讨论后，负责人确认（本会话）。

## 结论

| # | 决策 | 结论 |
|---|------|------|
| 1 | `knowledge-compiler-mvp` 全文是否继续 apply？ | **否** — 性价比中低；归档提案保留，标注 **pilot 后再评估** |
| 2 | 现在做什么？ | **两件**：① 已有不变量测试挂进发布流程（checklist / release-gate / CI），禁止悄悄绕过；② 对照法务交接 P0 缺口补/修 `demo/rules.demo.json`，用 `eval:benchmark-v3` / `eval:dataset` 验绿 |
| 3 | 覆盖矩阵？ | **可选、轻量**：手写 Markdown 够用；不绑 Hook Spec schema、不强制半自动工具 |
| 4 | Hook Spec / Candidate 状态机 / `knowledge:compile-check` / 五块顶层长文？ | **明确推迟** — 触发条件：KOS/Runtime Resolver 接线、多人并发改规则、或换模型/prompt 频繁到需要独立于词表的门禁 |
| 5 | 命名 | **「Knowledge Compiler」易误解为自动编译法条**；以后若捡起须改名（如「规则变更治理」）或处处写清边界 |

## 与 2026-07-31 落地的关系

同目录 `DECISIONS-2026-07-31.md` 与归档 change 已部分实现门禁与内容修补。本拍板是**方向纠偏**：后续主叙事是 **Runtime 规则精准度**，不是 Compiler 平台扩张。

**已基本落地（勿重复造轮）**：

- `pnpm test:compiler-gates`（`decision-invariants` + hook-spec 校验）与 `docs/release-checklist.md` 规则变更段
- 归档：`openspec/changes/archive/2026-07-31-knowledge-compiler-mvp/`
- 交接文档中多项 P0（SG 披露品类、CPSR/COE、APAC citation 占位替换等）已标完成

**仍须对齐本拍板的缺口（见 change `runtime-precision-slice`）**：

- ~~`scripts/release-gate.ps1` 尚未强制跑 `test:compiler-gates`~~ → **已接**（2026-08-04）
- 内容侧扫描：交接 / GATE 规则层 P0 **均已关闭** → 见 `openspec/changes/runtime-precision-slice/OPEN-P0-SCAN.md`（本切片无 pack bump）
- 不新增 Hook Spec 流水线、Candidate 状态机、compile CLI

## OpenSpec

- `knowledge-compiler-mvp`：**勿 apply**；归档留档 + 本文件交叉引用。
- 小 change：`openspec/changes/runtime-precision-slice/`（门禁接线为主；开放规则 P0 扫描无新增内容）。
