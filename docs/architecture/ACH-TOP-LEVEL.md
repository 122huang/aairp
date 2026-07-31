# Ad Compliance Hub — 顶层架构（一页纸）

> 对照手册：`全球广告合规法务审核规则手册_v0.9`（外部 OneDrive）  
> Runtime pack（今日）：`demo/rules.demo.json` + `demo/playbook.demo.md`  
> Compiler 变更：`openspec/changes/knowledge-compiler-mvp/`  
> 拍板（2026-07-31）：冻结规则扩面优先门禁；对外 demo citation 须法务 sign-off 或 disclaimer；ID/IN/VN/PH 不开产品 UI

## 五块顶层能力

```
┌──────────────── Review Workspace ────────────────┐
│                                                  │
│  Knowledge Platform ──Compiler──► Decision Runtime│
│           │                            │         │
│           └──── Evaluation & Release Gate ───────┘
└──────────────────────────────────────────────────┘
```

| 能力 | 职责 | 今日真源 / 入口 |
|------|------|----------------|
| **Review Workspace** | 审核提交、结果、历史 | `apps/review-app`（产品 UI 市场：SG/MY/TH/AU/CN/JP/KR） |
| **Knowledge Platform** | 五语料 + Pack 元数据；与 Runtime 刻意分离 | `docs/knowledge/*-corpus/`、KOS |
| **Knowledge Compiler** | 手册 hard → Hook Spec / Rule Candidate / 覆盖矩阵；**禁止自动写 ACTIVE** | `docs/knowledge/compiler/` |
| **Decision Runtime** | Rule → Playbook → Open Risk →（Vision）→ Fusion | `demo/rules.demo.json`、`demo/playbook.demo.md`、`demo/open-risk.prompt.txt` |
| **Evaluation & Release Gate** | 不变量 + dataset/benchmark；发布前必过 | `decision-invariants`、`pnpm eval:*`、`docs/release-checklist.md` |

## Runtime SoT（当前）

1. **可执行决策真源**：`demo/rules.demo.json`（pack 版本见文件头）+ `demo/playbook.demo.md`。  
2. **Knowledge Pack / KOS**：编指纹与预览，**默认不驱动**审核决策（C6）。  
3. **Compiler 产物**：中间层（Hook Spec / 矩阵 / Candidate）；人工 merge 进 demo pack 后才进 Runtime。  
4. **手册对照**：外部 v0.9；覆盖矩阵注明近似映射（`docs/knowledge/compiler/coverage-matrix.md`）。

## 机制层附录（不上对外顶层叙事）

| 机制 | 挂靠 |
|------|------|
| Hooks / Guardrails | Decision Runtime（BLOCKER 跳过 LLM、fusion 优先级等） |
| Eval runners | Evaluation Gate |
| RAG / Case-first | Runtime 可选插件；**默认关** |
| Memory | 未做；仅允许未来提示型，禁止自动写 ACTIVE |

## 产品市场策略（拍板）

- **产品 UI**：SG / MY / TH / AU / CN / JP / KR  
- **暂缓 UI**：ID / IN（规则可先于 UI；须 smoke/eval + 注册表对齐）  
- **不上 UI**：VN / PH（`legal_reviewed=false`，无市场卡）  
- **对外 demo**：citation 须法务 sign-off，或明确 disclaimer「citation 待补」  
- **本周冻结**：暂停新宣称类型 / 新市场规则扩面，优先 Compiler 门禁与 citation 硬化

## 相关链接

- OpenSpec（已归档）：`openspec/changes/archive/2026-07-31-knowledge-compiler-mvp/`  
- 主规格：`openspec/specs/knowledge-compiler/spec.md`  
- 法务交接：`docs/legal-pilot/法务交接与诊断文档.md`（含 Compiler 路径交叉链接）  
- Hook Spec：`docs/knowledge/compiler/hooks/` + `hook-spec.schema.json`  
- 发布清单：`docs/release-checklist.md`（含规则变更必跑不变量）  
- 本地/CI 门禁：`pnpm test:compiler-gates`
