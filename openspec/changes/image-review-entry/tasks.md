## 1. API 与上下文合约

- [x] 1.1 在演示审查提交 DTO / 校验中增加可选 `entry_mode`（`single` | `batch` | `image`，默认 `single`）
- [x] 1.2 将 `entry_mode` 传入 ReviewContext 或 advertisement 元数据，并在 case 记录中可追溯（若现有 schema 允许则写入，否则记录于报告上下文）
- [x] 1.3 确认图片入口提交时：图必填校验 + 核对文本映射到 `content.text`（及可选 `ocr_text` 快照）
- [x] 1.4 增加 `AAIRP_IMAGE_REVIEW_ENTRY=off|on`（默认 `off`）：提供前端/配置读取方式（如 status 接口或构建期 env），`off` 时不展示图片入口

## 2. 识别编排（复用现有 OCR/Vision）

- [x] 2.1 梳理图片入口「识别文字」调用路径：复用 `/demo/ocr/extract` 与/或 Vision `extracted_text`，定义合并去重策略
- [x] 2.2 提供前端可调用的识别结果结构（纯文本 + 可选分段），失败时返回可读错误
- [ ] 2.3 （可选）缓存本次会话识别结果，避免「开始审查」时重复全量抽字

## 3. 图片审查 UI

- [x] 3.1 扩展 `ReviewModeTabs`：增加「图片审查」tab（`image`），并受 `AAIRP_IMAGE_REVIEW_ENTRY` 控制是否渲染
- [x] 3.2 新增 `ImageReviewPanel`：上传区、识别按钮、可编辑识别文本框、开始审查、维度字段复用
- [x] 3.3 实现两段式状态机：未识别 / 识别中 / 已填框可编辑 / 审查中；无图禁止提交
- [x] 3.4 单条审查面板增加简短提示：完整审图请用「图片审查」
- [x] 3.5 结果区复用 DecisionBanner / FindingsList；高亮锚定核对后文本

## 4. 报告与门禁对齐

- [x] 4.1 `entry_mode=image` 时报告增加入口/识别文本来源说明
- [x] 4.2 确认可读性门禁与 Vision 抽字回灌在图片入口路径下仍生效（空核对稿 + 糊图 → REVIEW）
- [ ] 4.3 用九阳长图样例做一次手工验收清单（识别 → 改字 → 审查 → 报告）

## 5. 测试与回滚验收

- [x] 5.1 API：`entry_mode` 缺省兼容与 `image` 提交校验单测
- [x] 5.2 UI：模式切换与无图提交阻断的组件/集成测试（按项目现有测试习惯）
- [x] 5.3 回归：单条/批量入口行为不变
- [ ] 5.4 验收：开关 `off` 时 Tab 消失且单条/批量可用；`on` 时图片入口可用
