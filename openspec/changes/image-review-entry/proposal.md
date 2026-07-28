## Why

现有「单条审查」以文案为主、图片为可选附件，长图 PDP 场景下用户以为在审图，系统却常因文案框为空而漏掉图上宣称。审查内核（规则 / Playbook / Open Risk / Vision / 一致性 / 可读性门禁）可以复用，但需要独立的图片优先入口，并在审前用人眼核对识别文本。

## What Changes

- 在审查 UI 增加与「单条审查」「批量审查」并列的 **图片审查** 入口（第三模式）。
- 图片入口默认：上传图片（长图/多图）为必填；提供「识别文字」步骤，将 OCR/Vision 抽字填入可编辑文本框供人工核对后，再「开始审查」。
- 提交时携带核对后的文本 + 原图，走现有审查 pipeline；通过 `entry_mode`（或等价字段）区分入口，用于报告文案与统计，不复制第二套规则引擎。
- 增加入口级开关 `AAIRP_IMAGE_REVIEW_ENTRY`（默认关闭或仅内场开启）：关闭时隐藏「图片审查」Tab，单条/批量不受影响，便于不好用时回滚。
- 单条入口保留可选传图，但明确「附图不替代图片审查」；第一期不做批量图片审查。
- 复用已落地的 Vision 抽字回灌规则、功效/容量宣称扫描、可读性门禁；图片入口默认走两段式（识别 → 核对 → 审查）。

## Capabilities

### New Capabilities

- `image-review-entry`: 图片审查入口的 IA、两段式识别/核对/提交、与单条/批量入口的边界，以及报告/上下文中的入口模式标识。

### Modified Capabilities

- （无现有 openspec/specs 需改；审查引擎行为沿用当前实现，本变更以入口与 UX 合约为主。）

## Impact

- **UI**：`apps/review-app` — `ReviewModeTabs`、新 `ImageReviewPanel`（或等价组件）、识别结果文本框与提交流程。
- **API**：演示审查上传/OCR 抽取接口；请求体增加 `entry_mode: 'image' | 'single' | 'batch'`（命名以设计为准）；识别可复用 `/demo/ocr/*` 与 Vision 抽字路径。
- **应用层**：`ReviewPipelineService` / ContextBuilder — 接收核对文本为 `text`/`ocrText`/`visionText`；可读性门禁在图片入口下仍生效。
- **报告**：分支展示与说明文案按入口微调（识别文本、图片分支优先）。
- **非目标**：独立图片微服务、第一期批量图片、重写规则词表。
