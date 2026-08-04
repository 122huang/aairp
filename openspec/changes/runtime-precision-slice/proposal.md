## Why

产品 / 架构 / 负责人对 `knowledge-compiler-mvp` 结论一致：**全文性价比中低，先不做**。项目初心是提高审核精准度；下阶段只做「不变量进发布流程 + 法务 P0 内容进 Runtime SoT」，不做 Compiler 平台。

归档提案见 `openspec/changes/archive/2026-07-31-knowledge-compiler-mvp/`（2026-08-04 标注：pilot 后再评估）。拍板全文：`docs/knowledge/compiler/DECISIONS-2026-08-04.md`。

## What Changes

1. **门禁接线（若仍缺）**：确保本地 `release-gate` 与 checklist 强制跑已有 `decision-invariants` / `pnpm test:compiler-gates`（CI 已有则对齐本地脚本，不新造抽象）。
2. **内容抬准**：仅处理法务交接 / 法务总监复审中**仍开放**的 P0 规则缺口，写入 `demo/rules.demo.json`，用 `eval:benchmark-v3` / `eval:dataset`（及已有 apac-legal P0 golden 若适用）验绿。不重做已关闭项（如已完成的 CPSR/COE、citation 占位替换等）。
3. **可选**：维护手写覆盖矩阵 Markdown（已有 `docs/knowledge/compiler/coverage-matrix.md` 则只更新缺口行，不绑 Hook Spec、不扩半自动工具）。

## Capabilities

### New Capabilities

- `runtime-precision-slice`: 发布门禁接线 + 开放中的 Runtime 规则精准度内容修补。

### Modified Capabilities

- （无）不扩展 `knowledge-compiler` 主规格范围。

## Impact

- **脚本**：`scripts/release-gate.ps1`、`docs/release-checklist.md`（对齐表述）
- **规则**：`demo/rules.demo.json`（仅开放 P0）
- **评测**：现有 eval 命令
- **非目标**：Hook Spec 正式产物扩张、Candidate 状态机、`knowledge:compile-check`、顶层五块架构长文、默认 RAG/Memory、自动 ACTIVE
