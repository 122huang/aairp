## ADDED Requirements

### Requirement: 顶层能力与机制层边界

系统 SHALL 在项目文档中区分产品顶层能力与 AI 实现机制，避免将 Eval / RAG / Memory / Hooks 表述为对外顶层产品支柱。

#### Scenario: 架构文档列出顶层能力

- **WHEN** 维护者查阅本变更引入的架构说明
- **THEN** 文档 MUST 将 Review Workspace、Knowledge Platform、Decision Runtime、Evaluation & Release Gate、Knowledge Compiler 列为顶层能力，并 MUST 将 Hooks、RAG、Memory、Eval runners 标注为挂靠上述能力的实现机制

#### Scenario: Runtime SoT 声明

- **WHEN** 维护者查阅 SoT（单一真源）声明
- **THEN** 文档 MUST 写明当前 Decision Runtime 可执行规则的默认真源（demo rule/playbook pack），以及 Knowledge Pack / KOS 与 Runtime 的关系（默认不静默改写决策）

---

### Requirement: Hard 要求与 Hook Spec

Knowledge Compiler MVP SHALL 支持将法务手册或内部共识中的 hard 要求表示为可版本化的 Hook Spec，且 MUST NOT 在未经人工确认与评测门禁的情况下将候选直接发布为 ACTIVE 可执行规则。

#### Scenario: 记录 hard 要求

- **WHEN** 法务或维护者新增一条 hard 要求（例如某市场某类宣称必须 FAIL，或 BLOCKER 时不得进入 LLM）
- **THEN** 系统（或约定仓库产物）MUST 能以结构化 Hook Spec 记录适用市场、要求摘要、期望动作、手册/法规引用，以及状态（至少含 draft/candidate/accepted）

#### Scenario: 禁止自动写 ACTIVE

- **WHEN** Compiler 或自动化流程生成 Rule Candidate 或 Hook Spec
- **THEN** 该流程 MUST NOT 自动将产物写入 Runtime 正在消费的 ACTIVE demo rule pack（或等价生产真源）；MUST 保留人工确认步骤

#### Scenario: soft 要求不强制进 Hook Spec

- **WHEN** 要求仅为改写建议、披露优化等 soft 指导
- **THEN** Compiler MVP MAY 将其记入覆盖矩阵或备注，但 MUST NOT 要求其具备与 hard Hook Spec 相同的不变量测试

---

### Requirement: Evaluation 不变量门禁

系统 SHALL 为已 accepted 的 hard 决策不变量提供可自动执行的检验，使规则或融合逻辑回归时能够失败并阻断「视为已验证」的发布声明。

#### Scenario: BLOCKER 不被 LLM 推翻

- **WHEN** 运行决策不变量套件，且输入场景存在 Rule BLOCKER FAIL
- **THEN** 最终决策 MUST 为 REJECT（或项目约定的等价阻断结论），且 Open Risk / LLM 路径 MUST NOT 将结论降为 PASS

#### Scenario: 规则变更与门禁

- **WHEN** 维护者通过 Compiler 路径准备发布 hard 相关规则变更
- **THEN** 发布检查清单或脚本 MUST 要求运行不变量套件（及约定的相关 eval 子集），未通过则 MUST NOT 声称变更已验证

---

### Requirement: 覆盖矩阵

系统 SHALL 维护手册章节（或宣称类型）与可执行规则/Playbook/Open Risk 之间的覆盖矩阵，用于发现缺口并指导补齐，且 MUST 区分 legal_reviewed 市场与未法务背书市场。

#### Scenario: 矩阵可查询缺口

- **WHEN** 维护者查看覆盖矩阵
- **THEN** 矩阵 MUST 能标出「手册有要求但无对应 hard 规则/不变量」的缺口行，并 MUST 标注手册对照版本

#### Scenario: 未审市场降权

- **WHEN** 矩阵包含 VN 或 PH（或其它 `legal_reviewed=false` 市场）
- **THEN** 这些行 MUST 显式标记为未法务背书，且 MUST NOT 被表述为与 SG/MY/TH 同等置信的已覆盖市场

---

### Requirement: 样板端到端路径

Knowledge Compiler MVP SHALL 至少打通一条「发现缺口 → Hook Spec / Rule Candidate → 人工更新可执行 pack → 门禁通过」的样板路径，以验证流程可用。

#### Scenario: 样板闭环

- **WHEN** 团队选定一条真实 hard 缺口并完成样板
- **THEN** 仓库中 MUST 留有对应 Hook Spec（或 Candidate）、可追溯的规则变更、以及证明门禁曾通过的测试或报告引用

---

### Requirement: 本变更范围边界

本变更 MUST NOT 将 Case-first 默认开启、MUST NOT 交付跨审核会话 Memory 自动写入、MUST NOT 将 Knowledge Preview 改为输出合规裁决用语。

#### Scenario: 非目标保持关闭

- **WHEN** 本变更合并后检查默认配置与 Preview 文案边界
- **THEN** Case-first 相关开关 MUST 保持默认关闭（除非另有独立变更明确打开），Preview MUST NOT 使用「违规判定」类裁决措辞，且 MUST NOT 存在自动学习写 ACTIVE 的新默认路径
