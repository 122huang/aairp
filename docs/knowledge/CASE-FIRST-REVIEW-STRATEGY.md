# Case First Review Strategy

**Role:** Knowledge Architect design  
**Status:** Target architecture (Sprint 2B+ — not yet in runtime pipeline)  
**Version:** 1.0.0  
**Date:** 2026-06-26  
**Prerequisite:** [Case Library Architecture](./CASE-LIBRARY-ARCHITECTURE.md), Case Auto Save (JSON Phase 1)

---

## 1. Executive summary

**Case First Review** 将审核链路从「Rule → Playbook → **直接 LLM** → Decision」调整为：

```
Rule → Case Library → Playbook → LLM → Decision
```

**核心思想：** 在调用 Playbook 与 LLM 之前，先从 Case Library 检索 **已发生过的相似判例**，把 **确定性先例** 注入后续环节，使 Playbook / LLM 在 **有锚点、有边界** 的上下文中工作，而不是对冷文本做开放式推理。

| 维度 | LLM-first（现状） | Case-first（目标） |
|------|-------------------|---------------------|
| LLM 输入 | 广告文本 + Rule/Playbook 摘要 | 同上 + **Top-K 判例 + 证据 + 法规引用** |
| 未知场景 | LLM 自由推断 | 先查库；无先例再开放推理 |
| 幻觉风险 | 较高 | 被 Case 证据与引用约束 |
| 可解释性 | 依赖 LLM rationale | **Case ID + 先例决策** 可审计 |

**不变原则：**

- **Rule BLOCKER 仍最高优先级**；有 BLOCKER 时可跳过或极简 LLM（与现有一致）
- **Case 不替代 Rule**；Case 提供 **先例与建议**，不是硬法条引擎
- **Decision 仍融合多模块**；Case 作为独立模块 `CASE` 参与融合，权重低于 Rule BLOCKER

---

## 2. Current vs target pipeline

### 2.1 Current (Sprint 1 / 1.5)

```
Advertisement Upload
        ↓
Context Builder
        ↓
Rule Engine ─────────────────────────────┐
        ↓                                 │
Playbook Engine                           │ prior = rule + playbook only
        ↓                                 │
LLM (Open Risk) ←─────────────────────────┘
        ↓
Decision Engine (fuse Rule + Playbook + LLM)
        ↓
Review Report
        ↓
Case Auto Save (async, sidecar)
```

### 2.2 Target (Case First)

```
Advertisement Upload
        ↓
Context Builder
        ↓
Rule Engine
        ↓
Case Retrieval Engine  ←── Case Library (JSON → PG → Vector)
        ↓
Case Context Assembler (precedents, evidence, regulations)
        ↓
Playbook Engine (+ case-augmented context)
        ↓
LLM Open Risk (+ case-grounded prompt; conditional skip)
        ↓
Decision Engine (fuse Rule + Case + Playbook + LLM)
        ↓
Review Report (+ Similar Cases / Precedent section)
        ↓
Case Auto Save (async)
```

---

## 3. How Case participates in review

Case 以 **检索 → 组装 → 注入 → 可选产出 Case Finding** 四步参与，**不重新执行**历史审核逻辑。

### 3.1 Step 1 — Retrieve（Rule 之后）

**输入：**

- `ReviewContext`（country, platform, category, text, OCR, language）
- `RuleEvaluationResult`（已命中 rule ref_ids、BLOCKER 标志）

**检索策略（与 Case Library §6 一致，增强 Rule 信号）：**

| Stage | Action |
|-------|--------|
| Hard filter | `country_id`, `category_id`, `platform_id`（可回退 `*`） |
| Rule affinity boost | 优先 `matched_rules[].ref_id` 与当前 Rule 命中重叠的 Case |
| Lifecycle weight | `CONFIRMED` > `GENERATED`；`DISPUTED` 单独标记不自动跟从 |
| Semantic rank | Phase 3：embedding k-NN on ad text + OCR |
| Top-K | 默认 K=5，可配置 |

**输出：** `CaseRetrievalResult`

```json
{
  "review_id": "rev_…",
  "query_fingerprint": "sha256:…",
  "retrieval_strategy": "filter+rule_boost+vector_v1",
  "cases": [
    {
      "case_id": "case_019xyz",
      "similarity_score": 0.91,
      "rule_overlap": ["demo-sg-health-forbidden-claim"],
      "final_decision": "REJECT",
      "lifecycle_status": "CONFIRMED",
      "human_agreement": "AGREE",
      "recommendation_summary": "Remove cure claim",
      "reference_regulations": ["SG Health Products Act (Demo) §7"]
    }
  ],
  "exact_content_hash_match": false,
  "retrieved_at": "2026-06-26T12:00:00.000Z"
}
```

### 3.2 Step 2 — Assemble（Case Context）

将 Top-K Case 压缩为 **Playbook / LLM 可消费的上下文包** `CaseReviewContext`：

| 字段 | 用途 |
|------|------|
| `precedent_summaries[]` | 1–2 句/Case：决策 + 理由 + 关键证据 span |
| `shared_rule_refs[]` | 与当前 Rule 重叠的 ref_id 并集 |
| `regulation_citations[]` | 来自 Case 的 `reference_regulations` 去重 |
| `human_override_notes[]` | `DISPUTED` / 人工改判 Case 的 comment（防盲从未例） |
| `coverage_score` | 0–1，先例对当前广告的覆盖度 |

**不注入完整 Case JSON** 进 Prompt（控 token）；只注入 **结构化摘要 ===摘要===**。

### 3.3 Step 3 — Inject（Playbook & LLM）

**Playbook（Case-augmented）：**

- 输入：`ReviewContext` + `RuleResult` + **`CaseReviewContext`**
- 行为：Playbook pattern 匹配时，若存在 **同 ref_id 的 CONFIRMED Case**，提升该 pattern 置信度或生成 **CASE 模块交叉引用**
- 不修改 Playbook 硬编码逻辑的第一阶段；Sprint 2B 可为「高先例覆盖」增加 `case_precedent_hint` 输出字段

**LLM（Case-grounded，非直接 LLM）：**

- Prompt 新增段落 `{case_precedents_summary}`、`{known_regulation_refs}`
- 指令：**必须先对照先例；新结论须引用 case_id 或 rule ref；不得与 CONFIRMED 先例矛盾且无说明**
- **Skip 条件（扩展现有 HAS_BLOCKER）：**
  - `exact_content_hash_match && CONFIRMED final_decision` → 可 **SKIP_LLM**（可选 feature flag）
  - `coverage_score >= 0.95 && 全 CONFIRMED` → **LLM lite**（仅验证，不开放发现）

### 3.4 Step 4 — Case Findings（可选模块输出）

Case 检索层可产出 **`CaseFinding`**（module=`CASE`），类型为 **先例建议**，不是 BLOCKER：

```json
{
  "module": "CASE",
  "findingId": "cf_…",
  "severity": "MEDIUM",
  "decision": "WARN",
  "refType": "CASE_PRECEDENT",
  "refId": "case_019xyz",
  "summary": "3 similar CONFIRMED cases were REJECT for cure claims",
  "confidence": 0.88,
  "evaluationDetail": {
    "similarity_score": 0.91,
    "precedent_final_decision": "REJECT",
    "lifecycle_status": "CONFIRMED"
  }
}
```

**Decision 融合权重：** `RULE BLOCKER` > `RULE WARN` > `CASE (CONFIRMED)` > `PLAYBOOK` > `LLM` > `CASE (GENERATED only)`

---

## 4. How Case improves accuracy

| 机制 | 说明 | 效果 |
|------|------|------|
| **Precedent anchoring** | 同 country/category/platform 下优先 CONFIRMED 判例 | 降低跨国/跨品类误用规则 |
| **Rule + Case 双信号** | Rule 命中 + 先例同 ref_id → 高置信 WARN/REJECT | 提高 BLOCKER/WARN **召回** |
| **Human-in-the-loop 权重** | `human_feedback.decision` 已写入 Case；CONFIRMED 加权 | 对齐合规真实口径（如 Pilot L2 小家电 WARN） |
| **Negative precedent** | 相似文案但 PASS 的 Case 抑制过度 REJECT | 降低 **误杀** |
| **DISPUTED 隔离** | 人工推翻 AI 的 Case 不自动作为正例 | 防止错误先例复利 |
| **Exact hash 短路** | 完全相同 `content_hash` + CONFIRMED | 100% 一致复现，零 LLM 方差 |
| **Eval flywheel** | 新 Case 进入库 → 下一版检索更准 | 持续改进，不依赖单次 prompt 调优 |

**量化目标（Pilot / 2B 验收建议）：**

- L1 SG health：Decision accuracy 维持 ≥85%，BLOCKER recall 100%
- L2 新马泰小家电：`DISAGREE_DECISION` 率下降 ≥30%（相对无 Case 基线）
- CONFIRMED Case 覆盖场景：Case Finding 与人工一致率 ≥80%

---

## 5. How Case reduces hallucination

LLM 幻觉主要来自 **无 grounded 事实** 的开放生成。Case First 从五层约束：

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1 — Retrieve gate: 无先例 → 标记 "cold_start"      │
│           有先例 → LLM 必须在 precedents 范围内推理       │
├─────────────────────────────────────────────────────────┤
│ Layer 2 — Prompt grounding: 仅注入 Case 中已有 evidence  │
│           span + regulation_ref，禁止编造法条名           │
├─────────────────────────────────────────────────────────┤
│ Layer 3 — Output schema: LLM 输出须含 cited_case_ids[]   │
│           或 cited_rule_refs[]；空 citation → 丢弃 finding │
├─────────────────────────────────────────────────────────┤
│ Layer 4 — Guardrails (现有扩展):                        │
│           applyOpenRiskGuardrails + 先例矛盾检测           │
│           LLM 结论与 CONFIRMED 先例冲突且无 justification → drop │
├─────────────────────────────────────────────────────────┤
│ Layer 5 — Skip / Lite LLM: 高覆盖先例 → 少调用或不调用 LLM │
└─────────────────────────────────────────────────────────┘
```

| 反幻觉 tactic | 实现要点 |
|---------------|----------|
| **No cold hallucination** | Prompt: *If no precedent applies, say INSUFFICIENT_PRECEDENT* |
| **Citation required** | 每条 LLM finding 必须 `cited_case_id` 或 `evidence_span` 来自当前 ad 文本 |
| **Regulation whitelist** | `reference_regulations[]` 来自 Case+Rule 并集，LLM 不得引用库外法规名 |
| **Duplicate suppression** | 已有 Rule/Case/Playbook 覆盖的风险类型，LLM 不得重复杜撰 |
| **BLOCKER path unchanged** | Rule BLOCKER → skip LLM（现状）→ 消除最严重幻觉窗口 |

---

## 6. How Case supports explainability

审核报告新增 **Precedent & Similar Cases** 区块（只读展示，不改变决策时可先 advisory）：

### 6.1 Report sections

| Section | Content |
|---------|---------|
| **Why this decision** | 现有 rationale + Case 贡献说明 |
| **Similar precedents** | Top-3 `case_id`, `final_decision`, similarity_score, 1-line summary |
| **Regulatory basis** | 来自 Case + Rule 的 `reference_regulations` 去重列表 |
| **Evidence alignment** | 当前 ad span ↔ 先例 span 对照表 |
| **Human precedent** | 若引用 CONFIRMED 人工改判 Case，显示 reviewer 注释 |
| **Confidence breakdown** | Rule / Case / Playbook / LLM 分项贡献（可选） |

### 6.2 Traceability chain

```
advertisement_id
    → review_id
        → case_retrieval_result (which cases were considered)
            → case_id[] (click-through to full Case JSON)
                → human_feedback (if CONFIRMED)
                    → reference_regulations[]
```

### 6.3 Stakeholder views

| 受众 | Explainability 价值 |
|------|---------------------|
| **Compliance** | 「为何 REJECT」= Rule + **以前这样判过**（case_id 可查） |
| **Business / BD** | 相似先例 + recommendation.actions，改稿方向明确 |
| **Audit / Legal** |  immutable Case snapshot + 检索日志 |
| **Engineering** | retrieval_strategy + scores 可复现 |

---

## 7. Architecture

### 7.1 Component diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Review Orchestration Layer                         │
│  ReviewPipelineService (extended — Case stage inserted after Rule)           │
└─────────────────────────────────────────────────────────────────────────────┘
         │              │                    │                    │
         ▼              ▼                    ▼                    ▼
┌─────────────┐ ┌──────────────────┐ ┌─────────────┐ ┌─────────────────────┐
│ RuleEngine  │ │ CaseRetrieval    │ │ Playbook    │ │ OpenRiskDiscovery   │
│ Service     │ │ Engine           │ │ Engine      │ │ (LLM Gateway)       │
│ (existing)  │ │ (NEW)            │ │ (+case ctx) │ │ (+case-grounded     │
└─────────────┘ └────────┬─────────┘ └─────────────┘ │  prompt)            │
                         │                            └─────────────────────┘
                         ▼                                      │
              ┌──────────────────┐                              │
              │ CaseContext      │◄─────────────────────────────┘
              │ Assembler        │         prior = rule + case + playbook
              └────────┬─────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│ CaseSearch      │         │ CaseStore       │
│ Service         │         │ JSON / PG /     │
│ (filter+rank)   │         │ Vector Index    │
└─────────────────┘         └─────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │ DecisionEngine   │
              │ (+ CASE module)  │
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │ ReviewReport     │
              │ (+ Precedents)   │
              └──────────────────┘
```

### 7.2 New types (shared-kernel)

```typescript
type CaseRetrievalResult = {
  reviewId: string;
  cases: RetrievedCaseHit[];
  exactContentHashMatch: boolean;
  coverageScore: number;
  retrievalStrategy: string;
  retrievedAt: string;
};

type CaseReviewContext = {
  precedentSummaries: string[];
  sharedRuleRefs: string[];
  regulationCitations: CaseRegulationRef[];
  humanOverrideNotes: string[];
  coverageScore: number;
};

type CaseFinding = ModuleFinding & {
  module: 'CASE';
  refType: 'CASE_PRECEDENT';
};

type PriorFindingsSummary = {
  hasBlocker: boolean;
  ruleFindings: …;
  playbookFindings: …;
  caseFindings: …;      // NEW
  caseRetrieval?: CaseRetrievalResult;  // NEW
};
```

### 7.3 Pipeline sequence (pseudocode)

```typescript
async runThroughOpenRisk(context: ReviewContext) {
  const ruleResult = ruleEngine.evaluate(context);

  const caseRetrieval = await caseRetrievalEngine.retrieve({
    context,
    ruleResult,
    topK: 5,
  });
  const caseContext = caseContextAssembler.assemble(caseRetrieval);
  const caseFindings = caseFindingGenerator.fromRetrieval(caseRetrieval); // optional

  const playbookResult = playbookEngine.evaluate(context, {
    caseContext,
    ruleResult,
  });

  const prior = buildPriorFindingsSummary(ruleResult, playbookResult, caseFindings, caseRetrieval);

  const openRiskResult = await openRiskDiscovery.discover(context, prior, {
    caseContext,
    skipPolicy: resolveLlmSkipPolicy(ruleResult, caseRetrieval),
  });

  return { ruleResult, caseRetrieval, caseFindings, playbookResult, openRiskResult };
}
```

### 7.4 Decision fusion (extended)

| Signal | Typical weight | Can REJECT alone? |
|--------|----------------|-------------------|
| Rule BLOCKER | 1.0 | **Yes** |
| Rule WARN | 0.6 | No |
| Case CONFIRMED + similarity ≥0.9 + same rule refs | 0.5 | No (WARN+) |
| Case GENERATED only | 0.2 | No (advisory) |
| Playbook | 0.4 | No |
| LLM (grounded) | 0.35 | No |
| LLM (no case citation) | **discarded** | — |

`DecisionEngineService` 扩展输入：`caseFindings[]`；**不降低** Rule BLOCKER 优先级。

### 7.5 Feature flags & rollout

| Flag | Default | Purpose |
|------|---------|---------|
| `AAIRP_CASE_FIRST_ENABLED` | `false` | 总开关 |
| `AAIRP_CASE_IN_PLAYBOOK` | `true` | Case 注入 Playbook |
| `AAIRP_CASE_GROUND_LLM` | `true` | Case-grounded prompt |
| `AAIRP_CASE_SKIP_LLM_ON_EXACT_HASH` | `false` | 完全相同内容短路 LLM |
| `AAIRP_CASE_FINDINGS_IN_DECISION` | `false` | CASE 模块进入融合（先 report-only） |

**Rollout phases:**

| Phase | Scope |
|-------|-------|
| **2B-a** | Retrieve + Report precedents only（**不改变 Decision**） |
| **2B-b** | Case-grounded LLM prompt + guardrails |
| **2B-c** | CASE findings in Decision + Playbook augmentation |
| **2C** | Vector retrieval + auto-confirm flywheel |

### 7.6 Storage alignment

| Case Library Phase | Retrieval capability |
|--------------------|----------------------|
| Phase 1 JSON | Facet filter + rule overlap + content_hash exact |
| Phase 2 PostgreSQL | Full-text + SQL analytics |
| Phase 3 Vector | Semantic k-NN + hybrid score |

---

## 8. Example walkthrough

**Ad:** SG · Shopee · Health Supplement · *"Clinically proven to cure diabetes"*  

| Step | Outcome |
|------|---------|
| **Rule** | BLOCKER `demo-sg-health-forbidden-claim` |
| **Case retrieve** | Top-1: `case_example_sg_health_reject` (0.94, CONFIRMED, REJECT) |
| **Playbook** | urgency pattern maybe; boosted by case precedent |
| **LLM** | **Skipped** (`HAS_BLOCKER` — unchanged) |
| **Decision** | REJECT；rationale 引用 Rule + Case `case_…` |
| **Report** | Precedents 表 + regulation §7 + evidence span `cure` |

**Ad:** SG · Shopee · Electronics · *"Lower Sugar Healthier Every Bowl"*（Pilot P-002）

| Step | Outcome |
|------|---------|
| **Rule** | PASS（无 SG electronics 规则） |
| **Case retrieve** | 3× CONFIRMED WARN 先例（P-002 pilot cases after human confirm） |
| **Playbook** | health-claim pattern + case boost |
| **LLM** | Grounded prompt；须 cite `case_pilot_p002_sg`；输出 WARN health claim |
| **Decision** | WARN（Case + LLM 一致；无 Rule BLOCKER） |
| **Report** | 展示 3 先例 + 「无第三方检测不可 Lower Sugar/Healthier」 |

---

## 9. Non-goals & guardrails

| Non-goal | Reason |
|----------|--------|
| Case 替代 Rule Engine | 法条硬约束必须 deterministic |
| GENERATED Case 自动 REJECT | 需人工 CONFIRMED 或 Rule 才可直接拒 |
| LLM 无 citation 进入 Decision | 防幻觉 |
| 修改已存储 Case 的 AI 字段 | Immutable snapshot |
| Case 检索阻塞审核主路径 | Retrieve timeout → 降级为 Rule→Playbook→LLM（现行为） |

---

## 10. Summary

**Case First Review** 不是「用 Case 替 LLM」，而是 **在 LLM 之前插入判例层**：

1. **Rule** 定硬边界  
2. **Case** 提供 **相似先例、证据、法规引用**  
3. **Playbook** 在先例上下文做模式匹配  
4. **LLM** 仅做 **有锚点的开放风险** 补充，且须 citation  
5. **Decision** 融合时 Case 为 **可解释、可加权** 的独立模块  

由此同时实现：**更高准确率**（人工 CONFIRMED 先例）、**更低幻觉**（grounding + skip + guardrails）、**更强 Explainability**（case_id 可追溯先例链）。

---

**Related docs:**

- [CASE-LIBRARY-ARCHITECTURE.md](./CASE-LIBRARY-ARCHITECTURE.md)
- [docs/internal-pilot/](../internal-pilot/) — L2 GAP cases feed CONFIRMED precedents
- [docs/sprint-2a/SPRINT-PLAN.md](../sprint-2a/SPRINT-PLAN.md) — Knowledge foundation

**Next implementation Epic (suggested):** Sprint **2B — Case First Runtime** (CaseRetrievalEngine + report precedents, flag-gated)
