# 法务 Citation 签核表 — 批次 A + B

- Pack：`demo-rule-1.8.16`
- 生成：2026-07-31
- 产品 UI 市场：SG / MY / TH / AU / CN / JP / KR
- 状态：对外 demo 前须签完；未签完须保留 UI disclaimer
- 再生：`node scripts/_gen_citation_signoff_ab.mjs`

## 如何填写

| 字段 | 说明 |
|---|---|
| 结论 | `通过` / `需改` / `暂缓` |
| 修正后 law_name | 若需改，写可落地的完整法条名 |
| 修正后 article | 条款号 / 义务要点 |
| 签字 | 姓名 + 日期 |

**批次 A**：原 Demo/占位本地规则（pass 1 已去 Demo；待法务签核）。  
**批次 B**：七国共用 APAC-SA 高优先级规则（pass 1 已硬化 article/领域；待法务签核）。
- 工程处置：`docs/knowledge/compiler/citation-signoff-disposition.md`

## 批次 A — Demo / 占位 citation（本地规则）

### A.1 `demo-my-sa-market-claim`

- **市场**：MY
- **severity / decision**：MEDIUM / WARN
- **摘要**：马来西亚本地排名或权威背书类宣称须有依据支撑，且不得暗示获得官方医疗或政府背书
- **现行 law_name**：Malaysian Code of Advertising Practice (ASA Malaysia)
- **现行 article**：Misleading claims / substantiation of ranking & authority endorsement claims — must not imply official medical or government endorsement
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### A.2 `demo-my-sponsored-disclosure`

- **市场**：MY
- **severity / decision**：LOW / INFO
- **摘要**：该内容标注为网红/合作，发布前需确认已添加 MCMC/ASA Malaysia 要求的广告披露标签（#ad / #sponsored / Paid Partnership）。品牌方可能对未标注的付费内
- **现行 law_name**：Communications and Multimedia Content Code (MCMC) + Malaysian Code of Advertising Practice (ASA Malaysia)
- **现行 article**：Advertising identification / influencer disclosure (#ad, #sponsored, Paid Partnership); brand may bear vicarious liability for undisclosed paid content — regulation:my-masa-sponsorship-disclosure
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### A.3 `demo-sg-health-forbidden-claim`

- **市场**：SG
- **severity / decision**：BLOCKER / FAIL
- **摘要**：禁止使用绝对化的"治愈/根治"类健康宣称
- **现行 law_name**：Health Products Act (Singapore)
- **现行 article**：Section 7 — Prohibited claims (cure / miracle / absolute efficacy for health products; scope: health.supplement) — regulation:sg-hpa-s7-prohibited-claims
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### A.4 `demo-sg-sa-market-claim`

- **市场**：SG
- **severity / decision**：MEDIUM / WARN
- **摘要**：新加坡本地排名或专业背书类宣称须有依据支撑，且不得暗示获得官方医疗背书
- **现行 law_name**：Singapore Code of Advertising Practice (SCAP / ASAS)
- **现行 article**：Truthful presentation / substantiation of local ranking & endorsement claims — must not imply official medical endorsement
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### A.5 `demo-sg-sponsored-disclosure`

- **市场**：SG
- **severity / decision**：LOW / INFO
- **摘要**：该内容标注为网红/合作，发布前需确认已添加广告披露标签。非阻塞提醒（文案审核不核验披露标识是否已贴）。
- **现行 law_name**：Advertising Standards Authority of Singapore (ASAS) / Singapore Code of Advertising Practice
- **现行 article**：SCAP Rule 2.4 — Influencer / sponsored content must be clearly identified as advertising
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### A.6 `demo-th-sa-market-claim`

- **市场**：TH
- **severity / decision**：MEDIUM / WARN
- **摘要**：泰国本地排名或政府卫生机构背书类宣称须有依据支撑，且不得暗示获得官方医疗背书
- **现行 law_name**：Consumer Protection Act B.E.2522 (Thailand) + OCPB advertising guidance
- **现行 article**：Misleading advertisement provisions — local ranking / government-health-authority endorsement claims require substantiation
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### A.7 `demo-th-sponsored-disclosure`

- **市场**：TH
- **severity / decision**：LOW / INFO
- **摘要**：该内容标注为网红/合作，发布前需确认已添加 OCPB 要求的广告标识（泰文/英文清晰标注、平台广告标签）。非阻塞提醒（文案审核不核验披露标识是否已贴）。
- **现行 law_name**：OCPB Guidelines on Identification of Advertisements
- **现行 article**：Article 3 — Sponsored online / social content must be clearly labeled as advertising — regulation:th-ocpb-ad-identification
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

## 批次 B — 七市场 APAC-SA 高优先级

### B.1 `demo-apac-sa-absolute-claim`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：BLOCKER / FAIL
- **摘要**：绝对化宣称：无条件保证类用语（最佳、第一、绝不、零失误）且无可验证依据——视具体用词，经审计证据支持后可能通过（WARN/BLOCKER）
- **现行 law_name**：SG: Consumer Protection (Fair Trading) Act 2003 s.4 & Second Schedule; MY: Trade Descriptions Act 2011 s.18; TH: Consumer Protection Act B.E.2522 s.47-48; AU: Australian Consumer Law Sch 2 s 18; CN: 广告法（2021年第二次修正）第九条/第二十八条; JP: 景品表示法（不当景品類及び不当表示防止法）第5条; KR: 표시·광고의 공정화에 관한 법률 Art. 3/7
- **现行 article**：Absolute / omnibus superiority claims without verifiable basis — SG CPFTA s.4 Second Schedule; MY TDA s.18; TH CPA s.47-48; AU ACL s.18; CN 广告法第九条; JP 景品表示法 s.5; KR Fair Labeling Art. 3/7
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### B.2 `demo-apac-sa-certification-evidence`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：HIGH / REVIEW
- **摘要**：引用HEPA级过滤/实验室/认证类证据——引擎无法核实文件真实性与适用范围；需升级至产品合规团队确认（REVIEW）
- **现行 law_name**：SG: SCAP claims substantiation + CPFTA s.4; MY: TDA 2011 s.18; TH: CPA B.E.2522; AU: ACL Sch 2 s 18; CN: 广告法第十一条（证明文件 / 真实性）; JP: 景品表示法 s.5; KR: Fair Labeling Art. 3/7
- **现行 article**：Certification / lab / HEPA-class evidence references require authentic, in-scope documentary support — tool cannot verify certificate authenticity
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### B.3 `demo-apac-sa-comparative-claim`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：MEDIUM / WARN
- **摘要**：未经支撑的比较宣称：更强/更快/更安静，但缺乏可识别、可验证的对比基准（WARN）
- **现行 law_name**：SG: SCAP comparative advertising + CPFTA s.4; MY: TDA 2011 s.18 + MASA comparative hygiene; TH: CPA B.E.2522 / OCPB comparative ads guidance; AU: ACL Sch 2 s 18 + ACCC comparative advertising; CN: 广告法; JP: 景品表示法 s.5 comparative representations; KR: Monopoly Regulation and Fair Trade Act Art. 23 / Fair Labeling
- **现行 article**：Comparative superiority claims must be objective, substantiated, and non-denigrating
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### B.4 `demo-apac-sa-competitor-trademark`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：BLOCKER / FAIL
- **摘要**：未经授权使用第三方商标：可识别的竞品品牌、logo、产品外观或注册商标，且未取得权利人同意（REJECT）
- **现行 law_name**：SG: Trade Marks Act 1998 (+ passing off / CPFTA misleading where branding confuses); MY: Trade Marks Act 2019; TH: Trademark Act B.E.2534 (as amended); AU: Trade Marks Act 1995; CN: 商标法 + 反不正当竞争法; JP: 商標法 + 不正競争防止法; KR: Trademark Act + Unfair Competition Prevention Act
- **现行 article**：Unauthorised use of competitor brand, logo, product appearance, or registered mark in advertising
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### B.5 `demo-apac-sa-content-consistency-blocker`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：BLOCKER / FAIL
- **摘要**：广告素材之间的产品描述或物料信息不一致，须在发布前解决
- **现行 law_name**：SG: Consumer Protection (Fair Trading) Act 2003 s.4 & Second Schedule; MY: Trade Descriptions Act 2011 s.18; TH: Consumer Protection Act B.E.2522 s.47-48; AU: Australian Consumer Law Sch 2 s 18; CN: 广告法（2021年第二次修正）第九条/第二十八条; JP: 景品表示法（不当景品類及び不当表示防止法）第5条; KR: 표시·광고의 공정화에 관한 법률 Art. 3/7
- **现行 article**：Material inconsistency across ad text / images / claims that renders the representation misleading
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### B.6 `demo-apac-sa-false-authority-endorsement`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：BLOCKER / FAIL
- **摘要**：虚假认证或政府背书：未经核实的官方认证、部委推荐或暗示获得国家批准（REJECT）
- **现行 law_name**：SG: CPFTA s.4 + SCAP endorsement hygiene; MY: TDA 2011 s.18; TH: CPA B.E.2522; AU: ACL Sch 2 s 18; CN: 广告法第九条/第二十八条（虚假官方背书）; JP: 景品表示法 s.5; KR: Fair Labeling Art. 3/7
- **现行 article**：False or unverified government / ministry / official certification endorsement
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### B.7 `demo-apac-sa-food-safety-blocker`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：BLOCKER / FAIL
- **摘要**：食品安全隐患：画面展示生肉/海鲜/蛋类在烹饪前长时间未冷藏放置——在东南亚常温环境下存在真实的细菌滋生风险；改写无法消除该责任风险（REJECT）
- **现行 law_name**：SG: Sale of Food Act / Food Regulations (unsafe food depiction / handling representations); MY: Food Act 1983; TH: Food Act B.E.2522; AU: Food Standards Australia New Zealand / ACL misleading where unsafe practices contradicted; CN: 食品安全法 + 广告法; JP: 食品衛生法 hygiene representation hygiene; KR: Food Sanitation Act advertising hygiene
- **现行 article**：Depicting prolonged unrefrigerated raw meat/seafood/eggs before cooking as normal practice — food-safety hazard representation
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### B.8 `demo-apac-sa-health-claim-blocker`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：BLOCKER / FAIL
- **摘要**：医疗宣称：涉及疾病、器官功能、临床指标或医疗背书——小家电不得作出此类宣称，补充证据无法弥补越权问题（REJECT）
- **现行 law_name**：SG: SCAP (ASAS) health/medical claim standards + CPFTA s.4; MY: Trade Descriptions Act 2011 s.18 + advertising code health-claim hygiene; TH: CPA B.E.2522 s.47-48; AU: ACL Sch 2 s 18 + AANA/therapeutic boundary hygiene; CN: 广告法第九条/第二十八条; JP: 景品表示法 s.5 + 薬機法 efficacy boundary hygiene; KR: Fair Labeling Art. 3/7
- **现行 article**：Disease / organ-function / clinical-metric / medical-endorsement claims on small appliances — prohibited or require specialty regime; not cured by general substantiation alone
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### B.9 `demo-apac-sa-health-implication`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：MEDIUM / REVIEW
- **摘要**：健康暗示：感受/体验类描述（更轻盈、更清新、营养保留）但未涉及疾病/器官宣称——需人工核实是否已有对应语境/数据支撑（REVIEW）
- **现行 law_name**：SG: SCAP substantiation / health-implication hygiene + CPFTA s.4; MY: TDA 2011 s.18; TH: CPA B.E.2522 s.47-48; AU: ACL Sch 2 s 18; CN: 广告法第二十八条; JP: 景品表示法 s.5; KR: Fair Labeling Art. 3/7
- **现行 article**：Implied health / nutrition benefit without conditions or evidence — MANUAL_REVIEW / qualify wording (not a soft WARN-only path)
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### B.10 `demo-apac-sa-performance-claim`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：HIGH / WARN
- **摘要**：未经证实的量化宣称：给出数字或百分比但缺少对比基准、参照产品、测试标准或数据来源（WARN）
- **现行 law_name**：SG: Consumer Protection (Fair Trading) Act 2003 s.4 & Second Schedule; MY: Trade Descriptions Act 2011 s.18; TH: Consumer Protection Act B.E.2522 s.47-48; AU: Australian Consumer Law Sch 2 s 18; CN: 广告法（2021年第二次修正）第九条/第二十八条; JP: 景品表示法（不当景品類及び不当表示防止法）第5条; KR: 표시·광고의 공정화에 관한 법률 Art. 3/7
- **现行 article**：Quantified performance claims require objective substantiation (test conditions / method / scope) — misleading if unsubstantiated
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

### B.11 `demo-apac-sa-pricing-misrepresentation`

- **市场**：SG / MY / TH / AU / CN / JP / KR
- **severity / decision**：BLOCKER / FAIL
- **摘要**：误导性定价：虚假参考价、常态化限时促销、结算价高于宣传价、虚假的"即将下架"促销——属事实性虚假，非措辞问题（REJECT）
- **现行 law_name**：SG: Consumer Protection (Fair Trading) Act 2003 s.4 & Second Schedule; MY: Trade Descriptions Act 2011 s.18; TH: Consumer Protection Act B.E.2522 s.47-48; AU: Australian Consumer Law Sch 2 s 18; CN: 广告法（2021年第二次修正）第九条/第二十八条; JP: 景品表示法（不当景品類及び不当表示防止法）第5条; KR: 표시·광고의 공정화에 관한 법률 Art. 3/7
- **现行 article**：False reference price / perpetual flash sale / bait pricing / checkout total mismatch — misleading price representation
- **结论**：☐ 通过　☐ 需改　☐ 暂缓
- **修正后 law_name**：
- **修正后 article**：
- **备注**：
- **签字 / 日期**：

## 签核汇总

| 批次 | 条数 | 通过 | 需改 | 暂缓 | 签字人 | 日期 |
|---|---:|---:|---:|---:|---|---|
| A | 7 |  |  |  |  |  |
| B | 11 |  |  |  |  |  |

全部通过后工程动作：按修正更新 `demo/rules.demo.json` → 刷新覆盖矩阵 → 撤 `CITATION_DEMO_DISCLAIMER`。

