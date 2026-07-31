# 市场规则覆盖矩阵（初版）

- 生成时间：2026-07-31T02:35:41.647Z
- 手册对照：全球广告合规法务审核规则手册_v0.9（外部 OneDrive；Ch.5 宣称类型按 taxonomy 近似映射）
- Rules pack：`demo-rule-1.8.13`
- 产品 UI 市场：SG, MY, TH, AU, CN, JP, KR
- 暂缓：ID, IN；未法务背书：VN, PH（降权，不得与已审市场同置信）
- 再生：`node scripts/_gen_coverage_matrix.mjs`

## 状态图例

| 状态 | 含义 |
|---|---|
| HARD | 有 BLOCKER/FAIL 级 Rule |
| RULE | 有确定性 Rule（非 BLOCKER） |
| SOFT_ONLY | 仅 Playbook 和/或 Open Risk |
| GAP | 该市场无 rule/playbook 命中 |

## 产品 UI 市场摘要（缺口优先）

| 宣称类型 | SG | MY | TH | AU | CN | JP | KR | 缺口说明 |
|---|---|---|---|---|---|---|---|---|
| medical-health-claim | HARD | HARD | HARD | HARD | HARD | HARD | HARD | — |
| health-implication | RULE | RULE | RULE | RULE | RULE | RULE | RULE | — |
| absolute-superlative | HARD | HARD | HARD | HARD | HARD | HARD | HARD | — |
| performance-capacity | RULE | RULE | RULE | RULE | RULE | RULE | RULE | — |
| comparative-claim | RULE | RULE | RULE | RULE | RULE | RULE | RULE | — |
| certification-evidence | RULE | RULE | RULE | RULE | RULE | RULE | RULE | — |
| false-authority | HARD | HARD | HARD | HARD | HARD | HARD | HARD | — |
| sustainability-environment | RULE | RULE | RULE | RULE | RULE | RULE | RULE | — |
| scarcity-urgency | RULE | RULE | RULE | RULE | RULE | RULE | RULE | — |
| sponsored-disclosure | RULE | RULE | RULE | RULE | RULE | RULE | RULE | — |
| localisation | RULE | RULE | RULE | RULE | RULE | RULE | RULE | — |
| before-after-imagery | RULE | RULE | RULE | RULE | RULE | RULE | RULE | — |
| analogy-claim | RULE | RULE | RULE | RULE | RULE | RULE | RULE | — |
| pricing-misrepresentation | HARD | HARD | HARD | HARD | HARD | HARD | HARD | — |
| sensitive-content | SOFT_ONLY | SOFT_ONLY | SOFT_ONLY | SOFT_ONLY | RULE | SOFT_ONLY | SOFT_ONLY | SG:仅有 Playbook 和/或 Open Risk，无确定性 Rule；MY:仅有 Playbook 和/或 Open Risk，无确定性 Rule；TH:仅有 Playbook 和/或 Open Risk，无确定性 Rule |

## 降权市场（VN/PH）与暂缓（ID/IN）

| 宣称类型 | ID | IN | VN | PH |
|---|---|---|---|---|
| medical-health-claim | SOFT_ONLY | HARD* | SOFT_ONLY* | SOFT_ONLY* |
| health-implication | SOFT_ONLY | SOFT_ONLY* | SOFT_ONLY* | SOFT_ONLY* |
| absolute-superlative | SOFT_ONLY | HARD* | SOFT_ONLY* | SOFT_ONLY* |
| performance-capacity | GAP | GAP* | GAP* | GAP* |
| comparative-claim | SOFT_ONLY | SOFT_ONLY* | SOFT_ONLY* | SOFT_ONLY* |
| certification-evidence | HARD | SOFT_ONLY* | SOFT_ONLY* | SOFT_ONLY* |
| false-authority | GAP | GAP* | GAP* | GAP* |
| sustainability-environment | SOFT_ONLY | SOFT_ONLY* | SOFT_ONLY* | SOFT_ONLY* |
| scarcity-urgency | RULE | SOFT_ONLY* | RULE* | RULE* |
| sponsored-disclosure | RULE | SOFT_ONLY* | SOFT_ONLY* | RULE* |
| localisation | SOFT_ONLY | SOFT_ONLY* | SOFT_ONLY* | SOFT_ONLY* |
| before-after-imagery | GAP | GAP* | GAP* | GAP* |
| analogy-claim | SOFT_ONLY | SOFT_ONLY* | SOFT_ONLY* | SOFT_ONLY* |
| pricing-misrepresentation | GAP | GAP* | GAP* | GAP* |
| sensitive-content | SOFT_ONLY | SOFT_ONLY* | SOFT_ONLY* | SOFT_ONLY* |

\* VN/PH：`legal_reviewed=false`（无市场卡）；IN：手册有卡但引擎注册表未纳入 `LEGAL_REVIEWED`——均不得与产品 UI 同等置信。

## 明细（JSON 同源）

完整行数据见同目录 `coverage-matrix.json`。

### 优先补齐清单（从本矩阵导出）

- **sensitive-content** @ SG → `SOFT_ONLY` — 仅有 Playbook 和/或 Open Risk，无确定性 Rule
