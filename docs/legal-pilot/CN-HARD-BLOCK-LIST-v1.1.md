# CN 硬拦清单 v1.1（增量修订）

> 依据：`CN-DECISION-DR04-DR09-DR11.md`（法务总监 × 项目负责人拍板 2026-07-31）；干跑 `CN-CLUSTER-DRY-RUN-P1.md` DR07/08/09  
> 基线：`CN-HARD-BLOCK-LIST-v1.md`（已生效）**全文仍有效**；本文件仅修订附录增量  
> 版本锁定：`demo-rule-1.8.19` + `demo/locales/cn.json` locale_pack **1.2.0** + `demo-cn-absolute-terms-blocker` **v4**  
> **状态：按拍板纪要工程已落地；人审勾选下方栏位后视为签字生效**  
> **冲突规则：工程词表与 v1+本增量附录不一致时，以签字附录为准；未经法务确认不得再抬/降硬拦。**

## 1. 本版增量范围

| 来源 | 簇 | 处置 | 增量内容 |
|------|-----|------|----------|
| DR07 | `cn-health-clinical-result` | REJECT | 血脂指标、血脂下来了 |
| DR08 | `cn-health-clinical-result` | REJECT | 腰围小了、腰围小了两寸 |
| DR09 | `cn-art9-absolute` | REJECT | 词条「口碑王」+ pattern `(全网\|全国\|行业).{0,6}口碑王` |

**不在本版：** DR11「少生病」单锚（Open Risk 观察池，≥3 次/季度再认簇）；DR04「深度睡眠」无检测来源保持 REVIEW（见认簇说明 §4）。

## 2. 附录增量（完整追加文本）

### 2.1 `cn-art9-absolute` — 追加 forbidden_terms

口碑王

### 2.2 `cn-art9-absolute` — 追加 trigger_patterns

```
(全网|全国|行业).{0,6}口碑王
```

### 2.3 `cn-health-clinical-result` — 追加 cn.json medical-claim

血脂指标、血脂下来了、腰围小了、腰围小了两寸

## 3. 负例补充（不得硬拦 / 不得误入感受簇）

| 负例文案 | 说明 |
|----------|------|
| 买家都说闭眼入。 | 「闭眼入」不单锚 art9；须有「口碑王」等绝对化词才 REJECT |
| 首发三天卖爆 8 万台。 | unsourced WARN，**非** art9 |
| 深度睡眠模式 / 深度除螨 / 支持睡眠定时 | ≠ 深度睡眠功效感受 / clinical |
| 机身轻盈便携，旅行也能带。 | ≠ 身体轻盈 |

## 4. 验收

```bash
pnpm eval:cn-p0-golden
pnpm eval:cn-p1-golden
```

P0 须覆盖：全网口碑王 REJECT；血脂/腰围 REJECT；卖爆 WARN；提升免疫力整句 REJECT。

## 5. 签字栏

| 项 | 内容 |
|----|------|
| 确认 §1–§3 增量与 v1 不冲突、不混级 | □ 同意 |
| 确认版本锁定：`demo-rule-1.8.19` + cn locale **1.2.0** + absolute blocker **v4** | □ 同意 |
| 确认「少生病」不入本版附录 | □ 同意 |
| 签字人 / 日期 | 广告合规法务总监 / ____ |
| agent 代拟 | 已按拍板纪要落库；**人审勾选后方为正式签字** |
