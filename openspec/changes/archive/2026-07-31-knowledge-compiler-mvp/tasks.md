## 1. 叙事与 SoT

- [x] 1.1 新增一页架构说明（建议 `docs/architecture/ACH-TOP-LEVEL.md`）：五块顶层能力 + 机制层附录 + 与 PRD/手册关系
- [x] 1.2 写明 Runtime SoT：当前 demo rule/playbook；Knowledge Pack / KOS 边界；对照法务手册版本号与外部路径
- [x] 1.3 在 `docs/legal-pilot/法务交接与诊断文档.md` 或架构文中增加指向本 change 的「Compiler 路径」交叉链接（短段落即可）

## 2. Hook Spec 与产物布局

- [x] 2.1 确定目录与 schema（建议 `docs/knowledge/compiler/hook-spec.schema.json` + `hooks/*.json` 示例）
- [x] 2.2 种子化 3～5 条已存在铁律为 Hook Spec（如 BLOCKER 跳过 LLM、CN 绝对化 FAIL、fusion 优先级），状态 `accepted`
- [x] 2.3 增加 schema 校验脚本或 Vitest（非法字段/缺市场/缺引用则失败）
- [x] 2.4 （可选）Rule Candidate 模板文件与状态字段约定（`CANDIDATE` 不得被 runtime loader 读取）

产物：`docs/knowledge/compiler/hook-spec.schema.json`；hooks ×5（before-after / blocker-skips / cn-absolute / fusion-priority / llm-cannot-sole-reject）；校验 `node scripts/validate-hook-specs.mjs`；Candidate 模板 `rule-candidate.template.json`。

## 3. Eval 不变量门禁

- [x] 3.1 新增 `decision-invariants`（或等价）测试：BLOCKER → 跳过/忽略 LLM 降级；LLM 不得单独 REJECT 为最终唯一依据（与现网 fusion 行为对齐）
- [x] 3.2 将不变量套件纳入文档化的规则发布检查清单；评估是否挂入现有 `release-gate` / CI（能挂则挂，不能则清单强制）
- [x] 3.3 为「Compiler 相关变更」约定最小 eval 子集命令（写进架构文或 README 片段）

产物：`packages/application/src/review/decision-invariants.spec.ts`；`docs/release-checklist.md` 规则变更必跑段。

## 4. 覆盖矩阵

- [x] 4.1 初版矩阵：手册 Ch.5 宣称类型 × SG/MY/TH（及已有 legal_reviewed 市场摘要列）× rule_id / playbook / open-risk / 缺口
- [x] 4.2 矩阵标注手册版本与 `legal_reviewed`；VN/PH 降权行（若列出）
- [x] 4.3 （可选）从 `demo/rules.demo.json` 生成半自动汇总表，减少纯手维护

产物：`docs/knowledge/compiler/coverage-matrix.md` + `coverage-matrix.json`；再生 `node scripts/_gen_coverage_matrix.mjs`。同步：`demo-rule-1.8.10` 将 24 条 `demo-apac-sa-*` 宣称层扩至 AU/CN/JP/KR（localization / localization-cjk 仍限新马泰）。

## 5. 样板闭环

- [x] 5.1 从矩阵选 1 条真实 hard 缺口（优先 citation 占位或 SG/MY/TH 披露类）
- [x] 5.2 编写 Hook Spec + Rule Candidate → 人工合并进 demo pack（若需改代码）→ 跑不变量 + 相关 eval
- [x] 5.3 在 change 或 docs 中记录样板证据路径（报告/测试名）

样板：`before-after-imagery` → Hook Spec → `demo-apac-sa-before-after-imagery`。续：`demo-rule-1.8.12` disclosure/localisation；`demo-rule-1.8.13` 矩阵优先 citation 硬化（10 条）。

## 6. 验收与非目标核对

- [x] 6.1 验收：架构文 + schema + ≥3 Hook Spec + 不变量测试绿 + 矩阵初版 + 一样板证据
- [x] 6.2 核对非目标：Case-first 默认仍关；无 Memory 自动写；Preview 边界未改；无自动 ACTIVE 发布路径

拍板记录：`docs/knowledge/compiler/DECISIONS-2026-07-31.md`。
