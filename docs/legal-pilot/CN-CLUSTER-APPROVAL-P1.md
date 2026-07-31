# CN 认簇流程（P1）

> 适用：大陆话术扩词 / 新风险表述入库  
> 前置：`CN-HARD-BLOCK-LIST-v1` 已生效；硬拦簇变更须另走硬拦清单修订，不走本流程单独抬级

## 1. 原则

1. **认簇，不认散词**：法务/产品先判定概念簇与处置档，再落锚点词。  
2. **大陆词只进 `demo/locales/cn.json`**：禁止写入 `demo-apac-sa-*` 基表。  
3. **硬拦不可静默降级**：`cn-art9-absolute` / `cn-health-clinical-result` 变更须修订已签硬拦清单。  
4. **长尾不硬塞词表**：近义变体优先 Open Risk；词表只收高频锚点。

## 2. 簇目录（P1）

| 簇 ID | risk_type | 处置 | 说明 |
|-------|-----------|------|------|
| `cn-art9-absolute` | absolute-claim-blocker | REJECT | 已签硬拦 |
| `cn-health-clinical-result` | medical-claim | REJECT | 已签硬拦 |
| `cn-unsourced-sales-social-proof` | unsourced-metrics | WARN | 无来源数字 |
| `cn-health-feel-body` | health-implication | REVIEW | 身体/气色/精力感受 |
| `cn-health-feel-sleep-spirit` | health-implication | REVIEW | 睡眠/精神感受 |
| `cn-health-diet-wellness` | health-implication | REVIEW | 饮食/肠胃舒适感（非治病） |

## 3. 流程（中位目标 ≤3 个工作日）

```
新黑话 / 漏检
  → 产品归簇（填下表）
  → 法务认簇（同意处置档 + 锚点/负例）
  → 工程写入 cn.json（必要时补 pattern）
  → 金标正例 + 负例
  → pnpm eval:cn-p0-golden && pnpm eval:cn-p1-golden
  → 合并
```

### 认簇申请表（可贴到 PR / 工单）

| 字段 | 填写 |
|------|------|
| 原文例句 | |
| 建议簇 ID | |
| 建议处置 | REJECT / REVIEW / WARN / INFO / 不入库（Open Risk） |
| 建议锚点词（≤10） | |
| 负例（防误伤） | |
| 是否触及已签硬拦 | 是 / 否 |
| 申请人 / 日期 | |

### 法务认簇意见

| 项 | |
|----|--|
| □ 同意归入建议簇 | |
| □ 改归簇：________ | |
| □ 改处置：________ | |
| □ 驳回（理由）：________ | |
| 签字 / 日期 | |

## 4. 语境分流（已拍板 · DR04）

> 来源：`CN-DECISION-DR04-DR09-DR11.md`（2026-07-31）

空净/小家电语境下出现「深度睡眠」类表述时：

| 语境 | 簇 | 处置 |
|------|-----|------|
| **无**检测数据来源（无手环截图 / 睡眠报告 / 化验体检数据绑定） | `cn-health-feel-sleep-spirit` | REVIEW |
| 绑定 wearable / 报告 / 化验并宣称时长、比例等指标变化 | `cn-health-clinical-result` | REJECT（证据不可放行） |

**禁止**：仅因出现「深度睡眠」四字一律抬入硬拦；将「深度睡眠模式 / 深度清洁 / 深度除螨 / 睡眠定时」等功能或产品描述误入 health 簇。

## 5. 验收

- P0 金标不得回退：`pnpm eval:cn-p0-golden`  
- P1 健康簇金标：`pnpm eval:cn-p1-golden`  
- 负例系统性误拦 = 0  
- 混表守卫：CN 簇词不得出现在 `demo-apac-sa-*` 基表 JSON
