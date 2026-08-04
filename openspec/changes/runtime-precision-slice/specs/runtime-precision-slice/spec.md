## ADDED Requirements

### Requirement: 本地发布门禁包含决策不变量

系统 SHALL 在本地 release-gate 流程中执行与规则/融合铁律相关的已有不变量检验，使改规则或改 fusion 时不能仅依赖人工记忆。

#### Scenario: release-gate 跑不变量

- **WHEN** 维护者执行 `scripts/release-gate.ps1`（含 `-SkipLive`）
- **THEN** 流程 MUST 运行 `pnpm test:compiler-gates`（或等价：hook-spec 校验 + `decision-invariants`），失败则 MUST 使门禁失败

#### Scenario: 不新造抽象

- **WHEN** 落地本要求
- **THEN** MUST 复用已有 `decision-invariants.spec.ts` / `test:compiler-gates`，MUST NOT 引入 Candidate 状态机或新的 Hook 运行时

---

### Requirement: 开放中的 Runtime 规则精准度修补

系统 SHALL 允许将法务已排优先级且**尚未关闭**的 P0 规则缺口写入 Runtime SoT（`demo/rules.demo.json`），并用现有评测命令验证。

#### Scenario: 内容变更须验绿

- **WHEN** 本变更合入涉及 `demo/rules.demo.json` 的精准度修补
- **THEN** 变更说明 MUST 引用交接/复审条目，且 MUST 报告约定 eval（如 `eval:benchmark-v3` / `eval:dataset` 或适用的 apac-legal P0 golden）结果

#### Scenario: 不重做已关闭项

- **WHEN** 交接文档已标记某 P0 为已完成
- **THEN** 本变更 MUST NOT 以「再实现一遍」为目标重复该工作，除非复测证明回归

---

### Requirement: Compiler 全文推迟

本阶段 MUST NOT 将 Hook Spec 正式产物扩张、Candidate 状态机、`knowledge:compile-check` CLI 或顶层五块架构长文作为交付目标。

#### Scenario: 非目标保持

- **WHEN** 本变更合并后检查范围
- **THEN** 不得新增上述推迟项为默认路径；归档的 `knowledge-compiler-mvp` MUST 保持「勿 apply 全文 / pilot 后再评估」状态
