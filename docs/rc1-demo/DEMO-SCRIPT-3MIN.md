# RC1-Demo — 3 分钟演示话术

**受众：** 首次接触 AAIRP 的业务 / 产品 / 管理层  
**环境：** http://localhost:3000/demo-ui/ · API 已启动  
**推荐样例：** 先跑 **demo-01-reject-cure**，再快速展示 **demo-02-pass-food**

---

## 0:00 – 0:20 | 开场（价值主张）

> 「这不是把广告丢给 ChatGPT 问一句『有没有问题』。  
> AAIRP 把 **法规、规则、运营 Playbook、LLM、决策引擎** 串成一条 **可审计、可复现** 的审核流水线。  
> 每一次审核都会留下 **Knowledge Trace** 和 **Case 判例**，方便团队积累和复盘。」

**操作：** 打开 Demo UI，指出左上角 **RC1-Demo v1** 和 API 绿点。

---

## 0:20 – 1:30 | 主路径：REJECT 样例（核心）

**操作：** 左侧点击 **「禁词 cure → REJECT」** → **开始 AI 审核**

###  narrate 各阶段（跟随 Stepper 高亮）

| 时间 | 阶段 | 话术 |
|------|------|------|
| 0:25 | Upload | 「广告上传，带上国家、平台、品类——这是后面所有知识匹配的维度。」 |
| 0:35 | Context | 「Context Builder 绑定本次审核要用的 **Rule / Playbook 版本**——不是黑盒。」 |
| 0:45 | Regulation | 「法规层：SG Health Products Act 等 **引用进入 Trace**，Rule 命中时会带上法条。」 |
| 0:55 | Rule | 「**Rule Engine** 做确定性匹配——这里命中 BLOCKER 禁词 *cure*，**不需要问 LLM**。」 |
| 1:05 | Playbook | 「Playbook 是运营指引层，和法条规则分开维护。」 |
| 1:10 | LLM | 「有 BLOCKER 时 **LLM 被跳过**——省钱、省时、避免 LLM 与硬规则打架。」 |
| 1:15 | Decision | 「Decision Engine **融合**各模块，输出 REJECT + 置信度 + 理由。」 |
| 1:20 | Report | 「自动生成 HTML 审核报告。」 |
| 1:25 | Case | 「判例 **自动入库** Case Library——下次可检索相似案例。」 |

**操作：** 切到 **审核报告** 标签，展示 REJECT 色块与 findings 表。

---

## 1:30 – 2:00 | Knowledge Trace（差异化）

**操作：** 打开 **Knowledge Trace** 标签

> 「对比裸 LLM：这里每一步都有 **版本号、命中 ID、法规引用**。  
> 合规团队可以回答：『为什么拒？依据哪条 Rule？用的哪版 Playbook？LLM 有没有参与？』  
> 这是 **Explainability + Audit**——大模型单独做不到。」

---

## 2:00 – 2:30 | PASS 样例（对比）

**操作：** 返回 **审核流程**，选 **「合规食品 + #ad → PASS」** → 开始审核

> 「合规广告走完全链路：**Rule 0 命中、Playbook 0 命中、LLM 无额外风险 → PASS**。  
> 裸 LLM 可能对正常文案 **过度警告**；AAIRP 用确定性层 **减少误报**。」

（可只等 Stepper 跑完，不必重复讲每一格。）

---

## 2:30 – 2:50 | Case Library

**操作：** **Case Library** 标签 → 点击任一卡片看详情

> 「每次审核沉淀为 Case：维度、决策、matched rules、法规引用。  
> 这是 **组织记忆**——新人审核员可以查先例，而不是重新问 LLM。」

---

## 2:50 – 3:00 | 收尾（对比裸 LLM）

> 「总结三点优势：  
> **1. 确定性优先** — Rule/Playbook 先行，LLM 只补开放风险；  
> **2. 可治理** — 知识有版本、有 Trace、有 Case；  
> **3. 可扩展** — 新国家/新品类加 Rule Pack，不是改 Prompt 碰运气。  
> 下一步可以是 Internal Pilot 关账，或 KOS 后台运营这些知识对象。」

---

## 备用 Q&A（超时不展开）

| 问题 | 一句话回答 |
|------|------------|
| 真 LLM 了吗？ | RC1 用 Stub LLM；架构已留 Open Risk 接口，Pilot 可换真模型。 |
| 支持 MY/TH 吗？ | Demo 规则以 SG health 为主；dataset 有多国样例，规则 Pack 可扩展。 |
| 和 KOS 什么关系？ | KOS 运营 Regulation/Rule/Playbook/Prompt；Runtime 读取已发布版本。 |
