# RC1-Demo — 风险与免责说明

**版本：** RC1-Demo v1 · 2026-06-26  
**性质：** 工程演示 · **非法律意见 · 非生产系统**

---

## 1. 产品 / 法律免责

| 风险 | 说明 | 演示话术 |
|------|------|----------|
| **非法律建议** | Demo 规则与法规引用均为 SG Health Demo 示例 | 「工程 Demo，上线需法务审定。」 |
| **决策不可直接用于投放** | REJECT/WARN/PASS 需人工复核 | 「AI 辅助，最终由合规确认。」 |
| **Stub LLM** | Open Risk 为固定 Stub，非真 LLM | 「RC1 展示链路；Pilot 换真模型。」 |

---

## 2. 技术 / 演示风险

| ID | 风险 | 缓解 |
|----|------|------|
| R1 | 增量端点 review_id 可能不一致 | 以 POST /demo/review 页脚为准 |
| R2 | UI 多次 API 调用，演示约 5–8s | 主讲 reject 一条即可 |
| R3 | 规则 mainly SG health | 演示 stick SG 样例 |
| R4 | 无鉴权 | 仅内网演示 |
| R5 | 广告内存存储，重启失效 | 每次从 UI 重跑 |
| R6 | Regulation UI 为 manifest 展示 | 话术：法规经 Rule citation 进入 Trace |
| R7 | /ready 503 不影响 /demo/* | 可不查 ready |

---

## 3. 对比裸 LLM 的话术边界

**可以说：** Rule 先于 LLM；有 Trace 与 Case；BLOCKER 跳过 LLM。

**避免说：** 比 GPT 更准确；已覆盖所有国家；零误报。

---

## 4. RC1 范围外（勿承诺）

KOS Admin UI、RBAC、真 LLM、Case First 向量、异步 API、自动学习。

---

## 5. 事故回退

| 级别 | 动作 |
|------|------|
| API 500 | `curl -X POST .../demo/review -d @demo/sample-ad-upload.json` |
| UI 白屏 | 同上 curl + 展示 JSON report_html |
| Case 空 | 打开 case-library/cases/2026/06/ |
