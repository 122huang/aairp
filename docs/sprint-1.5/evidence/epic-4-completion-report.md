# Epic 4 — Demo Advertisement Dataset — Completion Report

**Date:** 2026-06-26  
**Epic Status:** **PASS (code)** / **Test gate OPEN (host env)**

---

## Story Summary

| Story | Title | Status |
|-------|-------|--------|
| E4-S1 | Dataset 结构与规范 | **PASS*** |
| E4-S2 | 8 国 × 4 品类内容 | **PASS*** |
| E4-S3 | sample-ad 纳入体系 | **PASS*** |

---

## E4-S1 — Dataset 结构

- `demo/dataset/index.json` — schema v1.0.0, 32 case entries
- `demo/dataset/README.md` — schema + add/remove guide
- Case schema: `case_id`, `intent`, `verification`, `upload`, `ground_truth`

---

## E4-S2 — 32 条广告样本

| 维度 | 覆盖 |
|------|------|
| 国家 | SG, MY, TH, ID, JP, KR, AU, PH (8) |
| 品类 | health.supplement, cosmetic, food, electronics (4) |
| 意图 | PASS / WARN / REJECT / EDGE 分布于各国 |

路径：`demo/dataset/{COUNTRY}/{category}/{case_id}.json`

---

## E4-S3 — sample-ad 迁移 + 工具

| 项 | 说明 |
|----|------|
| Canonical reject | `demo/dataset/SG/health.supplement/sg-health-reject-cure.json` |
| T11 兼容 | `demo/sample-ad-upload.json` 保留（内容一致） |
| Loader | `load-dataset.ts`, `dataset-evaluator.service.ts` |
| CLI | `pnpm eval:dataset` / `--auto` |
| 试用脚本 | `scripts/demo-review.ps1 -Case {case_id}` |
| 测试 | `dataset-index.spec.ts`（32 条完整性 + eval） |

---

## Ground truth 策略

| verification | 含义 |
|--------------|------|
| `auto` | 2 条 — 当前引擎可自动验证（SG reject-cure, SG electronics secure） |
| `manual` | 30 条 — `intent` 供 pilot 人工点检；`ground_truth.expected_decision: PASS`（尚无该国/品类规则） |

---

## 测试

| Command | Result |
|---------|--------|
| `pnpm test` (dataset-index.spec) | BLOCKED |
| `pnpm eval:dataset` | BLOCKED |

---

## Recommendation

Proceed to **Epic 5 — Bug Management** (台账已部分存在) or **Epic 6 — Release Readiness**.
