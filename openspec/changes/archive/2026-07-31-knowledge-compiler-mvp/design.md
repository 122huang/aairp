## Context

当前仓库现实（相对 GPT「四大平台」叙事）：

| 能力 | 现状 |
|------|------|
| Knowledge Platform | Sprint 5 V1 完成：语料、Pack、Preview/Feedback/Gap；与 Runtime **刻意分离** |
| Decision Runtime | Happy Path 稳定：Rule → Playbook → Open Risk →（Vision）→ Fusion；真源多为 `demo/rules.demo.json` + playbook |
| Evaluation | 离线 benchmark/dataset/regression 强；在线评测弱；未品牌化为「评测平台」 |
| Knowledge Compiler | **缺口**：手册→规则靠交接文档人工转写；Pack assembler 编元数据指纹，不编可执行决策产物；KOS 写入默认不进 Decision |

机制层现状：Hooks（fusion / BLOCKER 跳过 LLM / guardrails）已有；离线 Eval 已有；Case-first RAG 可选且默认关；跨审 Memory 未做。

本设计把 Compiler MVP 落成「治理编译 + 门禁」，不把 RAG/Memory 抬为顶层。

## Goals / Non-Goals

**Goals:**

- 一页顶层架构 + SoT 声明，统一内外部叙事。
- 定义 Hook Spec / hard 要求 schema，以及「编译 → 人工确认 → 候选」流程。
- 用不变量 Eval 锁死法务铁律；覆盖矩阵指导补规则。
- 为后续「候选 → Simulation → Publish → Runtime Resolver」留接口，但不在本 MVP 切换默认真源。

**Non-Goals:**

- 新建独立微服务或第二套规则引擎。
- LLM 自动把整本手册编译成 ACTIVE 规则。
- 默认开启 Case-first / 向量 RAG；组织级 Memory 自动学习。
- 九市场规则深度一次补齐；VN/PH 正式纳入 legal_reviewed。
- 修改 Knowledge Preview 语义（仍不得输出「违规判定」）。

## Decisions

### 1. 顶层五块，机制四项下沉

```
┌──────────────── Review Workspace ────────────────┐
│                                                  │
│  Knowledge Platform ──Compiler──► Decision Runtime│
│           │                            │         │
│           └──── Evaluation & Release Gate ───────┘
└──────────────────────────────────────────────────┘

机制：Hooks / Eval runners / RAG plugins / Memory(提示型)
```

- **选择**：对外/对内架构文档采用上述五块；Eval·RAG·Memory·Hooks 写在「实现机制」附录。
- **理由**：与已交付 Knowledge/Runtime 对齐，避免「再造四大平台」；机制仍可指导近期施工。

### 2. Compiler MVP 产物形态：声明式 Spec，而非直接改 demo JSON

编译输出三类产物（均可版本化、可 diff）：

1. **Hook Spec**（hard）：市场/宣称类型/动作（FAIL|跳过LLM|fusion不变量等）+ 手册章节引用。
2. **Rule Candidate Diff**：建议新增/修改的 `rule_id` 字段草案（trigger/forbidden/citation…），状态 `CANDIDATE`。
3. **Coverage Matrix 行**：手册章节 × country × 现有 rule/playbook/open-risk 映射与缺口标记。

- **选择**：MVP 以仓库内结构化文件（JSON/YAML/Markdown 表）+ 校验脚本为主；人工 merge 进 `demo/rules.demo.json` 仍是发布手段之一。
- **理由**：不破坏 Runtime 冻结原则；先有可审计中间层，再谈 gateway 接线。
- **备选**：直接写 KOS Rule ACTIVE — 否决（C6：KOS 写入不进 Decision，且缺 Simulation）。

### 3. hard vs soft

| 级别 | 落点 | 示例 |
|------|------|------|
| hard | Rule FAIL/BLOCKER 或 Fusion/Guardrail 不变量 | CN 绝对化用语禁止；BLOCKER 时跳过 Open Risk |
| soft | Playbook / Open Risk / 报告建议 | 改写建议、披露措辞优化 |

- Compiler MVP **只强制处理 hard**；soft 可记录在矩阵但不进 Hook Spec。

### 4. Eval 门禁与 Compiler 的关系

```
Candidate / Hook Spec 变更
        ↓
Invariant suite（必过）
        ↓
相关 benchmark / dataset 子集（按市场或 risk_id）
        ↓
人工确认发布说明
        ↓
（今日）更新 demo pack + 可选 KOS 双写存档
（未来）Runtime Resolver 读 PUBLISHED
```

- **选择**：不变量以 Vitest（或现有 eval 包）形式存在，命名清晰（如 `decision-invariants`）；release-gate 文档声明「规则变更必跑」。
- **理由**：已有 eval 基建，无需新平台。

### 5. Citation 绑定方向

- **选择**：Rule Candidate 的 `citation` 逐步改为引用 Regulation corpus / 台账编号（如 `CN-LAW-001`），减少自由文本占位法条。
- **MVP**：schema + 校验警告；允许过渡期并存。
- **不强制**：本变更内清掉全部 `APAC Advertising Standards (Demo)` 占位（可列为后续任务）。

### 6. 市场范围

- 覆盖矩阵与门禁优先：**SG / MY / TH / AU / CN / JP / KR**（产品主入口）+ 已 `legal_reviewed` 市场的规则缺口标注。
- VN/PH：矩阵中标记 `legal_reviewed=false`，不作为 Compiler 补齐目标。

### 7. 与机制层的映射（避免混称）

| 机制 | 挂靠 |
|------|------|
| Hooks | Decision Runtime 执行；由 Compiler 产出 Hook Spec |
| Eval | Evaluation Gate 执行器 |
| RAG | Runtime 可选插件（本变更不启用默认） |
| Memory | 仅允许未来「提示型」；本变更不做 |

## Risks / Trade-offs

- **[流程变重]** 多一层 Spec → 短期比直接改 JSON 慢 → 用最小 schema + 模板降低摩擦。
- **[双真源]** demo 与 Candidate 并存 → 文档明确「runtime 仍读 demo」直到 Publish Path 完成。
- **[手册版本漂移]** 手册在 OneDrive → SoT 声明必须写清对照版本号；矩阵注明手册版本。
- **[过度自动化诱惑]** 团队可能想让 LLM 直接编译 → 设计上 Candidate 永远需人审，Eval 挡自动 ACTIVE。

## Migration Plan

1. 落地文档与 schema（无行为变化）。
2. 种子化 3～5 条已存在的铁律为 Hook Spec + 不变量测试（行为应已满足，测试锁死）。
3. 建覆盖矩阵初版（只读分析 + 缺口列表）。
4. 选 1 条真实缺口走通「Spec → Candidate → 人工改 demo → eval」样板。
5. 后续 change：Runtime Resolver / KOS publish 接线（独立变更）。

回滚：删除/忽略 Compiler 产物目录不影响 Runtime；不变量测试可保留。

## Open Questions

- Hook Spec 文件放 `docs/knowledge/compiler/` 还是 `demo/compiler/`？（建议 `docs/knowledge/compiler/` 为声明，`demo/` 仍为可执行 pack。）
- 是否在本 MVP 增加 CLI（如 `pnpm knowledge:compile-check`）还是仅 Vitest？（建议两者都有最小入口。）
- 手册正文是否迁入仓库？（建议本变更只声明版本与路径，不强制迁入。）
