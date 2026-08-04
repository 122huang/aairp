## 1. 拍板落档（文档）

- [x] 1.1 写入 `docs/knowledge/compiler/DECISIONS-2026-08-04.md`
- [x] 1.2 归档提案 `knowledge-compiler-mvp` 顶部标注「pilot 后再评估 / 勿 apply」
- [x] 1.3 本小 change 脚手架（proposal / design / spec / tasks）

## 2. 门禁接线

- [x] 2.1 在 `scripts/release-gate.ps1` 中于 smoke 前强制 `pnpm test:compiler-gates`（失败 exit 1）
- [x] 2.2 核对 `docs/release-checklist.md` 与 CI 表述一致；注明实质=不变量+hook-spec 校验
- [x] 2.3 本地跑一遍 `.\scripts\release-gate.ps1 -SkipLive` 确认门禁包含 invariants（2026-08-04 PASS）

## 3. 内容抬准（仅开放项）

- [x] 3.1 扫描仍开放 P0 → 见 `OPEN-P0-SCAN.md`（规则层 P0 均已关闭）
- [x] 3.2 无开放规则 JSON 可写 → **本切片不 bump pack / 不改 rules.demo.json**
- [x] 3.3 以 `pnpm test:compiler-gates` 验证门禁；规则无 diff 故不强制全量 dataset（可选）

## 4. 可选矩阵

- [x] 4.1 无规则 diff → 不改 coverage-matrix（避免空转）

## 5. 验收

- [x] 5.1 release-gate -SkipLive 含 compiler-gates 且整门 PASS（2026-08-04）
- [x] 5.2 文档说明：本切片无开放规则 P0，仅门禁（`OPEN-P0-SCAN.md`）
- [x] 5.3 确认未新增 Hook Spec 流水线 / Candidate / compile CLI / 五块长文
