## Context

2026-07-31 已归档并部分落地 Compiler 门禁（`decision-invariants.spec.ts`、`pnpm test:compiler-gates`、CI 步骤、`docs/release-checklist.md`、覆盖矩阵）。2026-08-04 拍板纠正方向：主线是 **抬准**，不是 Compiler 平台。

## Goals / Non-Goals

**Goals:**

- 本地 release-gate 与 CI/checklist 对不变量门禁一致，改 fusion/规则时不能只靠「记得跑」。
- 开放中的法务 P0 内容进 demo pack，有 eval 证据。
- 文档口径：勿再推销 Knowledge Compiler 全文。

**Non-Goals:**

- Hook Spec / Candidate / compile CLI / 五块顶层叙事
- 重做已关闭的交接 P0
- Case-first 默认开、Memory、KOS→Runtime

## Decisions

1. **不重开 Compiler**：只维护小 change；归档提案加「pilot 后再评估」。
2. **门禁**：优先补 `release-gate.ps1` 调用 `pnpm test:compiler-gates`（CI 已有则保持）。
3. **内容**：以 `docs/legal-pilot/` 中仍开放项为准（如 LEGAL-DIRECTOR-GATE / 交接文档未勾完项），每条变更附 eval。
4. **矩阵**：可选更新现有 `coverage-matrix.md`，不新建工具链。

## Risks

- 误把已完成 P0 再改一遍 → 开工前对照交接「已完成」标记。
- 「compiler-gates」命名仍带 Compiler 字样 → 文档中注明实质是 invariants + hook-spec validate，非自动编译。
