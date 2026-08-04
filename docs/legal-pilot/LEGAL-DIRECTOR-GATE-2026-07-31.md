# 法务总监复审闸门 — 2026-07-31

**复审依据：** 七市场离线测评（规则 + Playbook，未开 LLM）· `demo/golden/_pilot-per-market-results.json` · [pilot-checklist-zh.md](./pilot-checklist-zh.md)  
**复审人：** 广告合规法务总监  
**工程响应 pack：** `demo-rule-1.8.21`（P0-1 / P0-2 已落地，闸门复测：`pnpm eval:apac-legal-p0-golden` **30/30 PASS**）

**离线复测摘要（`_pilot-per-market-results.json` 已刷新）：** SG/MY/TH/AU/JP/KR 演示 **demo-01 REJECT + demo-03 WARN** 已对齐；剩余 4/5 中未对齐项为 **demo-04 WARN→REVIEW**（P1 backlog，可接受）。CN 跑 SG 英文演示资产不要求对齐（不含 CN 的 APAC P0 规则）；CN C1–C4 仍走本地冒烟。

---

## 终审口径（可签字）

| 市场 | 终审 | 条件 |
|------|------|------|
| **CN** | **同意进入下一阶段** | 仅 CN 粘贴冒烟 / 规则+Playbook 内测；不开 LLM、不启 v1.1 §5 人审签字、不扩硬拦（C4 观察池） |
| **SG / MY / AU / JP / KR** | **P0 关闭前不放行生产** | P0-1/P0-2 复测通过后可再议演示验收；仍非法律放行 |
| **TH** | **附条件演示、生产否** | 仅 APAC 软社证 + 合规对照；**禁止**把 demo-01/demo-03 未修复前版本当合格案例；须标注决策辅助 |

---

## P0 整改与工程状态

| ID | 风险 | 工程处置 | 复测 |
|----|------|----------|------|
| **P0-1** | MY/TH/AU/JP/KR `health.supplement`「cure」缺 BLOCKER | 新增 `demo-apac-health-forbidden-claim`（**不含 CN**） | `eval:apac-legal-p0-golden` D01 |
| **P0-2** | 品牌文案缺 `#ad` 全市场 PASS | 新增 `demo-apac-brand-ad-disclosure` WARN（品牌/缺 ad_type；网红 INFO 规则保留；**不含 CN**） | 同脚本 D03 |
| **P0-3/4** | SG 演示完整性 / 对外口径 | P0-1/2 关闭后 SG 演示清单可再走；关闭前禁止宣称多市场可审上线 | 人审 + 清单 |
| **P0-5** | TH 演示 guardrail | 见上表 TH 行；演示脚本须口头免责 | 人审 |

**可接受 / backlog（P1）：** C2「口碑王」仅 CN REJECT；C4「少生病」观察池；demo-04 WARN→REVIEW 严重度；UI 真人走查；CN v1.1 §5 签字暂缓。

---

## 对人审 / 项目经理

- **项目经理：** 并行推进 **CN UI 走查闭环** + **本 pack 合入后复测**；勿扩 CN 硬拦清单；勿对外宣称七市场已可生产审核。  
- **人审：** 所有 REJECT/WARN 标注「需人工复核，不构成放行」；CN C1–C4 仅作规则层冒烟记录。

---

## 与既有拍板关系

- **不**扩 CN 硬拦 / 「少生病」附录（与观察池一致）。  
- 品牌缺 `#ad` → WARN 为法务总监 P0 覆盖：仅限 APAC 品牌付费文案（health/food/cosmetic）；网红场景仍 INFO 提醒。记入 [DECISIONS-2026-07-31.md](../knowledge/compiler/DECISIONS-2026-07-31.md) 附录。
