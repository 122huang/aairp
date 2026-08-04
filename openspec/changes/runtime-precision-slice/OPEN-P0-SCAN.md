# 开放 P0 扫描 — 2026-08-04（runtime-precision-slice）

对照：`docs/legal-pilot/法务交接与诊断文档.md`、`docs/legal-pilot/LEGAL-DIRECTOR-GATE-2026-07-31.md`。

## 规则层（可进 `demo/rules.demo.json`）

| 来源 | 项 | 状态 | 本切片处置 |
|------|-----|------|------------|
| 交接 §五 问题1 | SG sponsored 品类收窄 | 已完成（全品类 + ad_type） | 不重做 |
| 交接 §五 问题2 | CPSR / EECA-COE | 已完成（现为提醒/INFO 口径） | 不重做 |
| 交接 §五 问题3 | APAC citation 占位 | 已完成（SG/MY/TH 实法条 + disclaimer） | 不重做 |
| 总监 GATE P0-1 | APAC health cure BLOCKER | 已完成 `demo-apac-health-forbidden-claim`；`eval:apac-legal-p0-golden` 30/30 | 不重做 |
| 总监 GATE P0-2 | 品牌缺 #ad WARN | 已完成 `demo-apac-brand-ad-disclosure` | 不重做 |

**结论：本切片无新的开放「规则 JSON」P0 可写。** 抬准下一刀应来自新的法务清单或 P1 backlog（如 demo-04 WARN→REVIEW），不在本切片范围。

## 仍开放但非规则 SoT（本切片不做）

| 项 | 说明 |
|----|------|
| GATE P0-3/4/5 | 演示完整性 / 对外口径 / TH 口头免责 — **人审与发布口径**，非词表 |
| citation 法务 sign-off | disclaimer 先行，待书面签核 |
| Open Risk 准度评测 | 交接 §一修订待办 — 属 prompt/模型评测，非本切片 |
| evidence 预筛 AND / capacity trigger | 交接记录为独立模块待闭环 |

## 本切片实际交付

1. `release-gate.ps1` 强制 `pnpm test:compiler-gates`
2. `release-checklist.md` 对齐表述
3. 本扫描记录（无规则 pack bump）
