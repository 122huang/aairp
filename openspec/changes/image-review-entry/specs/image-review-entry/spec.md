## ADDED Requirements

### Requirement: 图片审查入口与模式切换

系统 SHALL 在审查应用中提供与「单条审查」「批量审查」并列的「图片审查」入口，使用户能够以图片为主要素材发起合规审查。

#### Scenario: 用户切换到图片审查

- **WHEN** 用户在审查页选择「图片审查」模式
- **THEN** 系统 MUST 展示图片优先工作区（上传区 + 识别文本框 + 识别/审查操作），且 MUST NOT 要求先填写独立营销文案才能上传图片

#### Scenario: 与单条/批量并存

- **WHEN** 用户在三种模式间切换
- **THEN** 系统 MUST 保持单条与批量现有能力可用，且图片模式 MUST 作为独立入口存在（不得仅以单条内隐藏开关替代）

---

### Requirement: 两段式识别与人工核对

图片审查入口 SHALL 支持先识别可见文字、再由人工编辑核对文本、最后提交审查的两段式流程。

#### Scenario: 识别文字填入可编辑文本框

- **WHEN** 用户已上传至少一张图片并触发「识别文字」
- **THEN** 系统 MUST 将抽取的可见文本填入可编辑文本框，供用户在审查前修改、删减或补充

#### Scenario: 核对后提交审查

- **WHEN** 用户在图片审查入口点击「开始审查」
- **THEN** 系统 MUST 提交原图以及文本框中当前（经人工核对后的）文本，并 MUST 使用与文案审查相同的审查 pipeline（规则 / Playbook / Open Risk / Vision / 一致性 / 决策）

#### Scenario: 无图不可审查

- **WHEN** 用户未上传图片即尝试开始图片审查
- **THEN** 系统 MUST 阻止提交并提示需要上传图片

---

### Requirement: 入口模式标识

系统 SHALL 在图片审查提交时标识入口模式，以便报告与后续统计区分作业类型，且 MUST NOT 因此复制第二套审查规则引擎。

#### Scenario: 提交携带 entry_mode

- **WHEN** 用户从图片审查入口成功提交审查
- **THEN** 请求 MUST 包含 `entry_mode` 为 `image`（或等价约定值），缺省兼容现有单条提交为非 image

#### Scenario: 报告可区分图片入口

- **WHEN** 一次 `entry_mode=image` 的审查生成报告
- **THEN** 报告 MUST 能体现该次审查来自图片入口（例如文案/识别文本来源说明或入口标签），且图片相关分支结果仍 MUST 可见

---

### Requirement: 图片审查入口可开关回滚

系统 SHALL 支持通过配置关闭图片审查入口的展示，以便在功能不佳时快速回滚且 MUST NOT 影响单条与批量审查。

#### Scenario: 开关关闭时隐藏入口

- **WHEN** `AAIRP_IMAGE_REVIEW_ENTRY`（或等价配置）为 `off`
- **THEN** 审查 UI MUST NOT 展示「图片审查」入口，且单条、批量审查 MUST 仍可用

#### Scenario: 开关开启时展示入口

- **WHEN** 该配置为 `on`
- **THEN** 审查 UI MUST 展示「图片审查」入口并允许按两段式流程使用

---

### Requirement: 单条入口边界提示

单条审查入口 MAY 继续允许附图，但系统 SHALL 避免用户误以为附图等同于完整图片审查。

#### Scenario: 单条提示使用图片入口

- **WHEN** 用户在单条审查界面看到传图能力
- **THEN** 界面 MUST 提供简要说明：完整审图请使用「图片审查」入口
