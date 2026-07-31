## Why

Ad Compliance Hub 已具备 Knowledge Platform（五语料 + Pack）与 Decision Runtime（Rule → Playbook → Open Risk → Fusion），但 **人读规则（法务手册）与可执行规则（`demo/rules.demo.json`）之间仍靠人工转写**，KOS / Knowledge Pack 默认不驱动审核决策。换模型、扩市场、加场景时，最大风险不是缺 RAG/Memory，而是「知识变更无法被编译、评测、再安全发布进 Runtime」。

近期讨论将 Eval / RAG / Memory / Hooks 定位为**实现机制**；长期顶层应为 Knowledge Platform + Decision Runtime + Evaluation Gate + **Knowledge Compiler**。本变更启动 Compiler MVP，把断裂处收成可治理流水线，而不是新建四大平台。

## What Changes

- 明确产品顶层能力与机制层边界（文档）：Workspace / Knowledge / Runtime / Eval / Compiler；Hooks·RAG·Memory·Eval 脚本为机制，不进对外顶层叙事。
- 引入 **Knowledge Compiler MVP**：将手册/语料中的 `hard` 要求编译为可追溯产物（Hook Spec / Rule 变更草案 / citation→Regulation 引用），经人工确认后进入候选，**禁止自动写 ACTIVE Pack**。
- 引入 **Eval 不变量门禁**：法务铁律（如 BLOCKER 不被 LLM 推翻）写成可执行测试/回归子集；Compiler 产出发布前必须过门。
- 建立 **手册章节 × 市场 × 可执行规则** 覆盖矩阵（先 SG/MY/TH + legal_reviewed 市场），指导补规则而非先扩 VN/PH。
- 记录 Runtime SoT 现状与迁移方向：今日真源仍为 demo rule/playbook pack；Compiler 闭合后可受控切换（本变更不强制切默认真源）。

## Capabilities

### New Capabilities

- `knowledge-compiler`: 知识编译 MVP——hard 要求声明、编译产物、人工确认、与 Eval 门禁及覆盖矩阵的合约；不含自动晋升 ACTIVE、不含 Memory/RAG 产品化。

### Modified Capabilities

- （无现有 `openspec/specs` 主规格需改；本变更以新增能力与文档/门禁合约为主，Runtime 行为默认保持冻结除非显式任务打开。）

## Impact

- **文档**：架构一页纸、SoT 版本声明、与 `docs/legal-pilot/法务交接与诊断文档.md` 的映射关系。
- **知识层**：Hook Spec / 覆盖矩阵产物路径；可选 Regulation ID 与 Rule citation 绑定草案（可不立即改 runtime）。
- **评测**：不变量测试 + Compiler 相关 eval 子集接入 CI / release-gate 策略（按任务落地）。
- **Runtime**：默认不改决策语义；仅预留「编译产物 → 候选规则」路径；Case-first / Memory / 全库 Regulation RAG **非本变更范围**。
- **非目标**：自动挖 Pattern、自动写 ACTIVE、默认开启 Case-first、Online Eval 平台、多租户、重写审查引擎。
