# 项目拍板记录 — 2026-07-31

| # | 决策 | 结论 |
|---|------|------|
| 1 | 是否冻结 pack 功能扩面约 1 周，优先 Compiler 门禁？ | **Yes** — 暂停新宣称类型 / 新市场规则扩面 |
| 2 | 对外 demo 是否要求 citation 法务 sign-off？ | **对外须 sign-off 或明确 disclaimer**；对内 pilot 可带「citation 待复核」 |
| 3 | ID/IN（及 VN/PH）是否维持 defer、不开产品 UI？ | **Yes** — VN/PH 无市场卡；ID/IN 待 smoke/eval + 注册表对齐 |

**Fallback（同日确认）**：法务 sign-off 未回前，**disclaimer 先行** + 对内 pilot 并行。UI：`CITATION_DEMO_DISCLAIMER`（`apps/review-app` DecisionBanner）。正式对外撤 disclaimer 前须法务书面确认。

产品 UI 市场保持：`SG / MY / TH / AU / CN / JP / KR`（见 `apps/review-app/src/lib/review-countries.ts`）。

**本周收口（项目负责人建议已执行）**：OpenSpec change 已归档至 `openspec/changes/archive/2026-07-31-knowledge-compiler-mvp/`；主规格同步 `openspec/specs/knowledge-compiler/spec.md`；CI 跑 `pnpm test:compiler-gates`。
