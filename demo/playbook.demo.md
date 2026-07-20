# Health Supplement Review Playbook (Demo)

pack_version: demo-playbook-1.7.1
playbook_id: demo-health-supplement-playbook
## urgency-cta

trigger_keywords: buy now, act now, limited time, hurry, 立即购买, only 3 left, while stocks last, 别再犹豫, 停产升级, 工厂说要停产, last chance, running out
severity_hint: MEDIUM
decision: WARN
guidance: Urgency/scarcity CTA detected (ASAS/ICC soft guidance: pressure language needs a verifiable offer end date or quantity — otherwise remove FOMO framing).
guidance_en: Urgency/scarcity CTA detected (ASAS/ICC soft guidance: pressure language needs a verifiable offer end date or quantity — otherwise remove FOMO framing).
guidance_zh: 检测到紧迫感/稀缺性CTA话术（ASAS/ICC软性指引：施压类用语需有可验证的优惠截止日期或数量限制，否则应删除FOMO式话术框架）。
typical_decision: REVIEW
skill_module: Disclaimer Review
purpose: Detect urgency or pressure language that may mislead consumers.
suggested_rewrite: Add offer validity dates / remaining stock facts, or remove pressure language.
expected_severity: MEDIUM
linked_rules: demo-apac-sa-urgency-scarcity-claim
match_mode: terms
## unsubstantiated-testimonial

trigger_keywords: clinically proven, doctor recommended, users love
severity_hint: HIGH
decision: REVIEW
guidance: Efficacy or testimonial claim detected. Require substantiation, qualification, or remove absolute wording before publishing.
guidance_en: Efficacy or testimonial claim detected. Require substantiation, qualification, or remove absolute wording before publishing.
guidance_zh: 检测到功效或用户见证类宣称。发布前须提供依据支撑、加以限定，或删除绝对化措辞。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Flag efficacy or testimonial claims that require substantiation or qualification.
suggested_rewrite: Replace absolute efficacy wording with qualified statements supported by evidence.
expected_severity: HIGH
## before-after-imagery

trigger_keywords: before and after, transformation, 前后对比
severity_hint: LOW
decision: CONDITIONAL
guidance: Before/after or transformation claim detected. Require disclaimers and avoid implying guaranteed outcomes.
guidance_en: Before/after or transformation claim detected. Require disclaimers and avoid implying guaranteed outcomes.
guidance_zh: 检测到前后对比或效果转变类宣称。须加免责声明，避免暗示效果必然达成。
typical_decision: CONDITIONAL_PASS
skill_module: Content Quality Review
purpose: Detect before/after or transformation imagery requiring disclaimers.
suggested_rewrite: Add disclaimers and avoid implying guaranteed outcomes.
expected_severity: LOW
## sa-absolute-performance

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: every time, every single time, foolproof, perfect, always works, flawless, never fails, never look back, best ever, the best, best machine, best machine ever, best in class, no.1, world no.1, world number one, every serving, every use, 每一次, 零故障, zero fault, zero-fault
severity_hint: MEDIUM
decision: WARN
guidance: Absolute or omnibus performance wording detected. Qualify the claim (conditions, typical results) or provide substantiation before publishing.
guidance_en: Absolute or omnibus performance wording detected. Qualify the claim (conditions, typical results) or provide substantiation before publishing.
guidance_zh: 检测到绝对化或全称性能表述。发布前须限定条件（使用条件、典型效果）或提供依据支撑。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Detect absolute or omnibus performance claims without conditions or substantiation.
suggested_rewrite: Qualify with typical results under normal use conditions or remove absolute wording.
expected_severity: MEDIUM
## sa-social-proof-claim

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
match_mode: link
linked_rules: demo-apac-sa-social-proof-claim
trigger_keywords:
severity_hint: MEDIUM
decision: WARN
guidance: Unsupported social proof or popularity claim detected (household counts, user totals, broad trust wording). Provide verifiable substantiation or qualify the claim before publishing.
guidance_en: Unsupported social proof or popularity claim detected (household counts, user totals, broad trust wording). Provide verifiable substantiation or qualify the claim before publishing.
guidance_zh: 检测到从众心理/受欢迎程度类宣称（家庭数量、用户总数、泛化的信任类用语）。发布前须提供可验证依据支撑，或加以限定。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Detect unsubstantiated social-proof or popularity claims without verifiable user or household data.
suggested_rewrite: Replace broad popularity counts with qualified, substantiated wording or cite the data source.
expected_severity: MEDIUM
## sa-health-implication

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: lower sugar, healthier, health benefits, healthy choices, natural goodness, natural enzymes, natural enzymes preserved, natural vitamins, daily nutrition, nutrition routine, improved indoor air quality, indoor air quality, 室内空气品质, cleaner indoor air, 营养成分, 天然营养, 天然营养成分, 保留果蔬, 减少营养流失, 冷萃设计, 少油烹饪, 少油, 更少油脂, 吃得更轻盈, 更轻盈, 更清爽, 吃得更清爽, 每天吃得更清爽, 饮食轻松, 轻松无负担, 无负担的美食体验, wholesome meals, goodness locked in, lighter cooking, lighter living, 除螨, 螨虫, 过敏源, 每天喝得更健康, 活力满满, 留住食材天然, cleaner eating, feel the difference, guilt-free, guilt free, wellness ritual, daily wellness, better you, step towards a better you, 补充营养, 蔬菜营养, 每日所需, 让孩子也爱上, 深呼吸, eaten well, breathe easy, whole benefits, think about what they eat, deserves better, 坐月子
severity_hint: MEDIUM
decision: REVIEW
guidance: Boundary: Health Implication refers to sensory/experiential wording; Medical Claim refers to disease and organ function. This pattern is a Health Implication — requires contextual qualification or softening, with supporting data where necessary; claims of reduced oil/nutrient retention require comparative or test data on file. Route to manual confirmation of whether external evidence/data is on file.
guidance_en: Boundary: Health Implication refers to sensory/experiential wording; Medical Claim refers to disease and organ function. This pattern is a Health Implication — requires contextual qualification or softening, with supporting data where necessary; claims of reduced oil/nutrient retention require comparative or test data on file. Route to manual confirmation of whether external evidence/data is on file.
guidance_zh: 分界：健康暗示（Health Implication）说的是感受与体验；医疗宣称说的是疾病与器官功能。本条为健康暗示 — 须语境限定或软化，必要时附数据；少油/营养保留类须持有对比或测试数据。命中后路由人工确认外部证据/数据是否到位。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Detect diet-wellness or nutrient-retention implications without specific disease or organ-function claims.
suggested_rewrite: 改为中性烹调/功能描述，或附上证据后再使用少油、更轻盈、保留营养类表述。
expected_severity: MEDIUM
## sa-medical-claim

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 肠胃消化, 免疫力, 心血管疾病, 糖尿病, 控糖, 临床验证, 临床认证, 肺部健康, 排毒, 净体, 改善体内环境, clinically proven, doctor-recommended, doctor recommended, nutrient absorption, blood sugar, high cholesterol, allergy symptoms, 过敏症状, 儿科医生, 儿科医生推荐, pediatrician, pediatrician recommended, cardiologist, your cardiologist, cardiologist would, would probably approve, pharmaceutical-grade, pharmaceutical grade, medically endorsed, heart disease, detox, cleanses your liver, boosts immunity, easy to digest, sterilize, sterilise, low-sugar, low sugar, medical-grade, medical grade, fat-reducing, fat reducing, less fat
severity_hint: HIGH
decision: WARN
guidance: Medical Claim: refers to disease, organ function, clinical metrics, or medical endorsement; small appliances have no authority to make medical claims — supplying evidence cannot cure this overreach, the offending wording must be removed.
guidance_en: Medical Claim: refers to disease, organ function, clinical metrics, or medical endorsement; small appliances have no authority to make medical claims — supplying evidence cannot cure this overreach, the offending wording must be removed.
guidance_zh: 医疗宣称（Medical Claim）：指向疾病、器官功能、临床指标或医疗背书；小家电无权作医疗声明，补证据不能解决越权，须删除越线表述。
typical_decision: REJECT
skill_module: Claim Review
purpose: Block medical or disease-specific claims and clinical or professional endorsements on non-health product categories.
suggested_rewrite: 删除疾病、器官功能、临床验证及医生/机构背书表述；不得暗示治疗、预防或改善特定疾病。
expected_severity: HIGH
## sa-comparative-claim

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: more efficient, less noise, less wear, better than, cleaner than, cleaner way to cook, 比传统, compared to conventional, conventional deep frying, number one, no.1, world no.1, better rice, every family needs, goes beyond, large capacity, cook faster, comparison with, smarter, 销量第一, 销量冠军, 排名第一, 无可超越, 无出其右, nothing else comes close, #1, thailand's no.1, 更强劲, 更快加热, 更安静, 更高效, more powerful suction, heats faster, quieter operation, better heat distribution, more vitamins than, than high-speed
severity_hint: MEDIUM
decision: WARN
guidance: Comparative claim detected. State the baseline (vs which product) and test conditions, or soften the wording.
guidance_en: Comparative claim detected. State the baseline (vs which product) and test conditions, or soften the wording.
guidance_zh: 检测到比较类宣称。须说明对比基准（对比的是哪款产品）及测试条件，或软化措辞。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Detect comparative claims missing baseline product or test conditions.
suggested_rewrite: State the comparison baseline, test method, and measurable difference.
expected_severity: MEDIUM
## sa-performance-claim

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: non-stick, juice yield, purer juice, 68% less, 70% less, up to 70%, 70%, 75% less, up to 75%, 75%, 80% less, up to 80%, 80%, up to 30%, 30%, up to 25%, 25%, 减少高达, 用油量, 节能高达, removes up to 99%, in 30 minutes, 16-hour, freshness mode, 70kpa, 38%, 38% more, retains 38%, 76%, filtration rate, 99.7%
severity_hint: HIGH
decision: WARN
guidance: Quantitative or efficacy performance claim detected. Verify substantiation, test conditions, and on-pack specifications before publishing. Oil/energy-reduction percentages (e.g. 70%/75%/80% / up to 30% energy saving) require verifiable test data on file.
guidance_en: Quantitative or efficacy performance claim detected. Verify substantiation, test conditions, and on-pack specifications before publishing. Oil/energy-reduction percentages (e.g. 70%/75%/80% / up to 30% energy saving) require verifiable test data on file.
guidance_zh: 检测到量化或功效性能宣称。发布前须核实依据支撑、测试条件及包装标注规格。用油量/节能百分比宣称（如70%/75%/80%、节能高达30%）须持有在档的可验证测试数据。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Detect quantitative or efficacy performance claims requiring verification.
suggested_rewrite: Remove specific percentages unless test data is on file; state comparison method, product model, and oil-measurement protocol.
expected_severity: HIGH
## sa-certification-evidence

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: national standard grade, authoritative certification, third-party laboratory, standard lab conditions, lab conditions, 标准实验室, restaurant-quality, patented, if award, hepa-class, hepa class, hepa级, hepa滤网, medical-grade filter, captures 99%, 医用级过滤, มอก, 权威机构认证, 权威机构, PM2.5, pm2.5, TÜV, TÜV SÜD, tuv, tuv sud, certified by, 第三方检测
severity_hint: HIGH
decision: REVIEW
guidance: Certification, patent, award, or laboratory evidence referenced. HEPA-class is not equivalent to True HEPA; มอก/TISI marks require scope verification — confirm document authenticity, scope, and readability before publishing. Tool cannot verify certificate validity; escalate for product-compliance check.
guidance_en: Certification, patent, award, or laboratory evidence referenced. HEPA-class is not equivalent to True HEPA; มอก/TISI marks require scope verification — confirm document authenticity, scope, and readability before publishing. Tool cannot verify certificate validity; escalate for product-compliance check.
guidance_zh: 引用了认证、专利、奖项或实验室证据。HEPA级不等同于True HEPA；มอก/TISI标志需核实适用范围——发布前须确认文件真实性、适用范围及是否清晰可辨。工具无法核实证书有效性；须升级至产品合规团队核查。
typical_decision: REVIEW
skill_module: Evidence Review
purpose: Verify certification, patent, award, or laboratory evidence authenticity and scope.
suggested_rewrite: Confirm document authenticity, scope, and readability before publishing.
expected_severity: HIGH
## sa-comparative-superiority

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: goes beyond, beyond standard, world no.1, no.1, world's best, the best, best in class
severity_hint: HIGH
decision: WARN
guidance: Superiority or beyond-standard comparative claim detected. State benchmark product, test method, and measurable difference.
guidance_en: Superiority or beyond-standard comparative claim detected. State benchmark product, test method, and measurable difference.
guidance_zh: 检测到优越性或超越标准类比较宣称。须说明对比基准产品、测试方法及可量化的差异。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Detect superiority or beyond-standard comparative claims.
suggested_rewrite: Name the benchmark product, test method, and measurable difference.
expected_severity: HIGH
## sa-capacity-claim

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
match_mode: link
linked_rules: demo-apac-sa-capacity-claim
trigger_keywords:
severity_hint: MEDIUM
decision: WARN
guidance: Capacity or volume claim detected. Confirm test method, fill level, and on-pack specifications.
guidance_en: Capacity or volume claim detected. Confirm test method, fill level, and on-pack specifications.
guidance_zh: 检测到容量或体积类宣称。须核实测试方法、装载量及包装标注规格。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Detect capacity or volume claims requiring test-method confirmation.
suggested_rewrite: Confirm fill level, test method, and on-pack specifications.
expected_severity: MEDIUM
## sa-oil-reduction-quantified

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 80% less oil, 75% less oil, 70% less oil, less oil, 用油量, 减少用油, 少油烹饪, 节能高达, energy saving, less energy, 节电高达
severity_hint: HIGH
decision: WARN
guidance: Quantified claims such as reduced oil use/energy saving (e.g. "reduces oil use by up to 70%/75%/80%", "saves up to 30% energy") must be backed by verifiable test data on file (comparison method, model, and calculation basis) before publishing. Bare percentages without oil/energy context belong to performance/quantitative patterns — do not trigger this oil-reduction pattern.
guidance_en: Quantified claims such as reduced oil use/energy saving (e.g. "reduces oil use by up to 70%/75%/80%", "saves up to 30% energy") must be backed by verifiable test data on file (comparison method, model, and calculation basis) before publishing. Bare percentages without oil/energy context belong to performance/quantitative patterns — do not trigger this oil-reduction pattern.
guidance_zh: 减少用油量/节能等量化宣称（如「减少高达70%/75%/80%用油量」「节能高达30%」）须持有可核验的测试数据（对照方法、机型、测算口径）后方可发布。裸百分比无油/能耗语境时不命中本模式。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Quantified oil-use reduction claims requiring test data substantiation.
suggested_rewrite: 删除具体百分比，或改为定性表述并附上可出示的实验数据与对照说明。
expected_severity: HIGH
## sa-mite-allergen-claim

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 除螨, 螨虫, 过敏源
severity_hint: HIGH
decision: REVIEW
guidance: Claims of mite removal or allergen reduction must be backed by a valid third-party test report (institution, sample, test conditions, and conclusion) on file before publishing. Route to manual confirmation of whether the report is on file.
guidance_en: Claims of mite removal or allergen reduction must be backed by a valid third-party test report (institution, sample, test conditions, and conclusion) on file before publishing. Route to manual confirmation of whether the report is on file.
guidance_zh: 除螨、减少过敏源等宣称须持有有效的第三方测试报告（机构、样品、测试条件与结论）后方可发布。命中后路由人工确认报告是否在档。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Mite removal or indoor allergen reduction claims requiring laboratory test reports.
suggested_rewrite: 删除除螨/抗过敏源效果结论，或改为功能描述（如配备除螨刷头）并附测试报告备查。
expected_severity: HIGH
## sa-diet-oil-wellness

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 少油烹饪, 少油, 饮食轻松, 饮食更加轻松, 轻松无负担
severity_hint: MEDIUM
decision: REVIEW
guidance: Dietary-health implications such as "less oil" or "lighter eating" must be backed by evidence (comparative cooking-oil data or compliant nutritional basis) before publishing. Route to manual confirmation of whether evidence is on file.
guidance_en: Dietary-health implications such as "less oil" or "lighter eating" must be backed by evidence (comparative cooking-oil data or compliant nutritional basis) before publishing. Route to manual confirmation of whether evidence is on file.
guidance_zh: 「少油」「饮食轻松」等饮食健康暗示须持有证据支持（烹调用油对比数据或合规营养表述依据）后方可发布。命中后路由人工确认证据是否到位。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Less-oil or diet-ease wellness implications requiring substantiation evidence.
suggested_rewrite: 改为中性烹调功能描述，或附上证据后再使用少油/饮食轻松类表述。
expected_severity: MEDIUM
## sa-localization

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: chinese product image, chinese manual, chinese subtitles, chinese warranty card, 待确认, change to english, cqc, gb标准, [tbd], [insert claim here], voltage listed as 240v
severity_hint: MEDIUM
decision: WARN
guidance: Asset appears localized for another market. Use English/local packaging, manual, or subtitles for the target country.
guidance_en: Asset appears localized for another market. Use English/local packaging, manual, or subtitles for the target country.
guidance_zh: 素材疑似为其他市场本地化的版本。目标国家须使用相应的英文/当地语言包装、说明书或字幕。
typical_decision: REVIEW
skill_module: Localization Review
purpose: Detect assets localized for a market other than the target country.
suggested_rewrite: Use English or local-market packaging, manual, or subtitles for the target country.
expected_severity: MEDIUM
## sa-disclaimer-required

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: missing ai disclaimer, missing ai generated disclaimer, ai rendered image without disclaimer
severity_hint: LOW
decision: WARN
guidance: Add illustration disclaimer for AI-rendered or synthetic imagery (e.g. for illustration purposes only).
guidance_en: Add illustration disclaimer for AI-rendered or synthetic imagery (e.g. for illustration purposes only).
guidance_zh: AI渲染或合成图片须加注示意图免责声明（如"仅供示意"）。
typical_decision: REVIEW
skill_module: Disclaimer Review
purpose: Require illustration disclaimer for AI-rendered or synthetic imagery.
suggested_rewrite: Add an illustration disclaimer (e.g. for illustration purposes only).
expected_severity: LOW
## sa-grammar-quality

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
match_mode: link
linked_rules: demo-apac-sa-grammar-quality
trigger_keywords:
severity_hint: LOW
decision: WARN
guidance: Grammar, spelling, or time-format error detected. Correct before publishing.
guidance_en: Grammar, spelling, or time-format error detected. Correct before publishing.
guidance_zh: 检测到语法、拼写或时间格式错误。发布前须修正。
typical_decision: REVIEW
skill_module: Content Quality Review
purpose: Detect grammar, spelling, or time-format errors in copy.
suggested_rewrite: Correct grammar, spelling, and time-format errors before publishing.
expected_severity: LOW
## sa-food-safety-overnight-prep

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: raw chicken before bed, load raw chicken, prep raw fish and marinated chicken before bed, load raw pork, raw pork before bed, raw pork and marinated fish, 放入鸡肉, 生鸡肉, 放入牛腩, 将猪肉, 晚上放入, 隔夜慢炖
severity_hint: HIGH
decision: WARN
guidance: Food Safety Hazard: depicting raw meat/seafood/eggs or other perishable ingredients left unrefrigerated for extended periods before cooking. Real bacterial-growth risk exists under ambient conditions in Southeast Asia; the copy itself may serve as evidence of product liability — rewording the description cannot eliminate the risk, the scene must be removed.
guidance_en: Food Safety Hazard: depicting raw meat/seafood/eggs or other perishable ingredients left unrefrigerated for extended periods before cooking. Real bacterial-growth risk exists under ambient conditions in Southeast Asia; the copy itself may serve as evidence of product liability — rewording the description cannot eliminate the risk, the scene must be removed.
guidance_zh: 食品安全场景（Food Safety Hazard）：描绘生肉/海鲜/蛋类等易腐食材在无冷藏条件下长时间放置后烹饪。东南亚常温下存在真实细菌繁殖风险，文案本身可作为产品责任证据；改表述不能消除风险，必须删除该场景。
typical_decision: REJECT
skill_module: Claim Review
purpose: Block ads depicting unrefrigerated overnight raw-meat, seafood, or egg prep scenarios.
suggested_rewrite: 完全删除生肉/海鲜/蛋类常温隔夜放置的烹饪场景；不得仅用替换食材淡化风险。
expected_severity: HIGH
## sa-material-safety-claim

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: bpa-free, bpa free, 不含bpa, 无bpa, food-grade, 食品级, non-toxic coating, 无毒涂层, 304不锈钢, stainless steel interior, all-natural materials, 零有害物质
severity_hint: HIGH
decision: WARN
guidance: BPA-free and similar material safety claims must be backed by a third-party test report (e.g. SGS, Intertek) before publishing; without a report, use a neutral material description instead, or hold the claim until documentation is available.
guidance_en: BPA-free and similar material safety claims must be backed by a third-party test report (e.g. SGS, Intertek) before publishing; without a report, use a neutral material description instead, or hold the claim until documentation is available.
guidance_zh: BPA-free 等材质安全宣示须持有第三方检测报告（如 SGS、Intertek 等）后方可发布；无报告则改为中性材质描述或备查后再用。
typical_decision: REVIEW
skill_module: Evidence Review
purpose: Material safety claims (e.g. BPA-free) requiring third-party laboratory substantiation.
suggested_rewrite: 删除 BPA-free 等材质安全结论，或附上可出示的第三方检测报告后再发布。
expected_severity: HIGH
## sg-local-market-claim

scope_countries: SG
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 新加坡销量第一, 新加坡销量, singapore's #1, singapore cardiologists, endorsed by singapore cardiologists, endorsed by singapore
severity_hint: HIGH
decision: WARN
guidance: Singapore-local sales ranking or professional-endorsement claim detected. Hold market-share substantiation and avoid implying official medical endorsement.
guidance_en: Singapore-local sales ranking or professional-endorsement claim detected. Hold market-share substantiation and avoid implying official medical endorsement.
guidance_zh: 检测到新加坡本地销售排名或专业背书类宣称。须持有市场份额依据支撑，避免暗示获得官方医疗背书。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Flag Singapore-specific ranking or cardiologist endorsement claims requiring local substantiation.
suggested_rewrite: Remove #1/Singapore ranking unless substantiated; replace doctor endorsement with qualified, verifiable statements.
expected_severity: HIGH
## my-local-market-claim

scope_countries: MY
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 马来西亚销量冠军, 马来西亚销量, malaysia's #1, national health authorities, certified by national health, 千万家庭, 马来西亚千万家庭
severity_hint: HIGH
decision: WARN
guidance: Malaysia-local sales ranking or authority-endorsement claim detected. Hold market-share substantiation and avoid implying official medical or government endorsement.
guidance_en: Malaysia-local sales ranking or authority-endorsement claim detected. Hold market-share substantiation and avoid implying official medical or government endorsement.
guidance_zh: 检测到马来西亚本地销售排名或权威背书类宣称。须持有市场份额依据支撑，避免暗示获得官方医疗或政府背书。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Flag Malaysia-specific ranking or authority endorsement claims requiring local substantiation.
suggested_rewrite: Remove #1/Malaysia ranking unless substantiated; replace authority endorsement with qualified, verifiable statements.
expected_severity: HIGH
## th-local-market-claim

scope_countries: TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 泰国销量排名第一, 泰国销量, thailand's no.1, thailand's ministry of public health, 泰国卫生部
severity_hint: HIGH
decision: WARN
guidance: Thailand-local sales ranking or Ministry of Public Health endorsement claim detected. Hold market-share substantiation and avoid implying official medical endorsement.
guidance_en: Thailand-local sales ranking or Ministry of Public Health endorsement claim detected. Hold market-share substantiation and avoid implying official medical endorsement.
guidance_zh: 检测到泰国本地排名或卫生部背书类宣称。须持有市场份额依据支撑，避免暗示获得官方医疗背书。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Flag Thailand-specific ranking or government-health-authority endorsement claims requiring local substantiation.
suggested_rewrite: Remove #1/Thailand ranking unless substantiated; replace ministry endorsement with qualified, verifiable statements.
expected_severity: HIGH
## id-local-market-claim

scope_countries: ID
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: terbaik, nomor satu, terpercaya, #1 indonesia, nomor 1
severity_hint: MEDIUM
decision: WARN
guidance: Indonesia-local sales ranking or superiority claim detected. Hold market-share substantiation and avoid implying official medical or government endorsement.
guidance_en: Indonesia-local sales ranking or superiority claim detected. Hold market-share substantiation and avoid implying official medical or government endorsement.
guidance_zh: 检测到印尼本地销售排名或优越性宣称。须持有市场份额依据支撑，避免暗示获得官方医疗或政府背书。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Flag Indonesia-specific ranking or superiority claims requiring local substantiation.
suggested_rewrite: Remove terbaik/nomor satu ranking unless substantiated with audited local market data.
expected_severity: MEDIUM
## vn-local-market-claim

scope_countries: VN
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: số 1, hàng đầu, tốt nhất thị trường, số một, thị trường số 1
severity_hint: MEDIUM
decision: WARN
guidance: Vietnam-local ranking or market-leader claim detected (warn-tier enforcement). Hold ranking methodology and period substantiation.
guidance_en: Vietnam-local ranking or market-leader claim detected (warn-tier enforcement). Hold ranking methodology and period substantiation.
guidance_zh: 检测到越南本地排名或市场领先类宣称（按WARN级别执行）。须持有排名方法及统计周期依据支撑。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Flag Vietnam-specific ranking claims requiring local substantiation under MOIT advertising rules.
suggested_rewrite: Remove số 1/hàng đầu claims unless substantiated with verifiable ranking source and period.
expected_severity: MEDIUM
## ph-local-market-claim

scope_countries: PH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: pinakamahusay, number one, #1 sa pilipinas, #1 sa philippines, numero uno
severity_hint: MEDIUM
decision: WARN
guidance: Philippines-local ranking or superiority claim detected. Hold market-share substantiation and avoid misleading comparative representations.
guidance_en: Philippines-local ranking or superiority claim detected. Hold market-share substantiation and avoid misleading comparative representations.
guidance_zh: 检测到菲律宾本地排名或优越性宣称。须持有市场份额依据支撑，避免使用误导性比较表述。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Flag Philippines-specific ranking claims requiring substantiation under Consumer Act misleading-representation rules.
suggested_rewrite: Remove pinakamahusay/#1 sa Pilipinas claims unless substantiated with audited local data.
expected_severity: MEDIUM
## sa-false-authority-endorsement

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 卫生部临床认证, 卫生部推荐, 国家权威机构认证, 国家强制安全认证, ministry of health, ministry of public health, national health authorities, government quality bodies, endorsed by national
severity_hint: HIGH
decision: WARN
guidance: Fake or unverifiable government/ministry/national-authority health endorsements must not be used. Remove wording referencing ministries, government bodies, or national-grade certification; a description of a presentable third-party test report may be retained instead.
guidance_en: Fake or unverifiable government/ministry/national-authority health endorsements must not be used. Remove wording referencing ministries, government bodies, or national-grade certification; a description of a presentable third-party test report may be retained instead.
guidance_zh: 虚假或无法核验的政府/部委/国家级机构健康背书不得使用。删除部委、政府、国家级认证表述；可保留可出示的第三方检测报告描述。
typical_decision: REJECT
skill_module: Evidence Review
purpose: Block false government, ministry, or national-authority health endorsements.
suggested_rewrite: 删除政府/部委背书；改为可核验的第三方检测或合规认证表述。
expected_severity: HIGH
## sa-competitor-trademark

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: dyson logo, midea logo, philips product image, competitor trademarks visible, 竞品商标, than dyson, than philips, 比midea, 比飞利浦, outperforms leading brands
severity_hint: HIGH
decision: WARN
guidance: Unauthorised competitor trademarks/product imagery must not appear in comparison images, scene imagery, or copy. Trademarks must be obscured, authorisation obtained, or the comparison rewritten without naming the competitor.
guidance_en: Unauthorised competitor trademarks/product imagery must not appear in comparison images, scene imagery, or copy. Trademarks must be obscured, authorisation obtained, or the comparison rewritten without naming the competitor.
guidance_zh: 对比图、场景图或文案中未经授权的竞品商标/产品图不得出现。须遮挡商标、取得授权或改为不指名对比。
typical_decision: REJECT
skill_module: Brand/IP Review
purpose: Block unauthorized competitor trademarks or product images in comparative assets.
suggested_rewrite: 移除可辨识竞品商标/产品图，或取得书面授权并标注来源。
expected_severity: HIGH
## sa-pricing-misrepresentation

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 划线价, 限时48小时, 即将涨价, 出厂价直销, strikethrough price, never sold at, flash sale, price increases tomorrow, closing-down sale, mandatory service fee not shown
severity_hint: HIGH
decision: WARN
guidance: Misleading pricing such as fake strikethrough prices, perpetual "limited-time" promotions, or hidden mandatory fees must not be used. Must display the genuine reference-price basis, the promotion period, and the total price inclusive of tax/accessories.
guidance_en: Misleading pricing such as fake strikethrough prices, perpetual "limited-time" promotions, or hidden mandatory fees must not be used. Must display the genuine reference-price basis, the promotion period, and the total price inclusive of tax/accessories.
guidance_zh: 虚假划线价、常态化「限时」促销、隐藏必选费用等误导性定价不得使用。须展示真实参考价依据、促销期限及含税/含配件总价。
typical_decision: REJECT
skill_module: Claim Review
purpose: Block misleading pricing mechanics and perpetual urgency promotions.
suggested_rewrite: 删除虚假参考价与永久限时话术；在显著位置披露促销期限与结账总价。
expected_severity: HIGH
## sa-analogy-claim

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 媲美, 如同石锅, 宛如现榨, 像专业面包房, 餐厅级别, restaurant-quality results, clay-pot, bakery-style, as fresh as cold-pressed, slow-cooked over an open flame
severity_hint: MEDIUM
decision: WARN
guidance: Analogical/sensory-equivalence claims (e.g. restaurant-grade, wood-fired, clay-pot, bakery-style) must be backed by sensory testing or a reasonable qualifier, avoiding any implication that professional or traditional cooking results are guaranteed.
guidance_en: Analogical/sensory-equivalence claims (e.g. restaurant-grade, wood-fired, clay-pot, bakery-style) must be backed by sensory testing or a reasonable qualifier, avoiding any implication that professional or traditional cooking results are guaranteed.
guidance_zh: 类比/感官等同宣称（餐厅级、柴火、石锅、面包房等）须有感官测试或合理限定语支撑，避免暗示必然达到专业或传统烹饪效果。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Detect analogy or sensory-equivalence claims requiring substantiation.
suggested_rewrite: 改为「灵感来自」类限定表述，或附上感官评测方法与典型结果说明。
expected_severity: MEDIUM
## sa-sustainability-claim

scope_countries: SG, MY, TH
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: 环保设计, 可持续材质, 减少碳足迹, 绿色制造, 零污染生产, 可回收材料, eco-friendly design, sustainable materials, carbon footprint, green manufacturing, recycled materials
severity_hint: MEDIUM
decision: WARN
guidance: Environmental/sustainability claims must be backed by evidence regarding materials, energy consumption, or manufacturing process, avoiding vague "protect the planet"-style wording.
guidance_en: Environmental/sustainability claims must be backed by evidence regarding materials, energy consumption, or manufacturing process, avoiding vague "protect the planet"-style wording.
guidance_zh: 环保/可持续宣称须有材料、能耗或生产工艺证据支撑，避免笼统「守护地球」式表述。
typical_decision: REVIEW
skill_module: Claim Review
purpose: Detect environmental or sustainability claims requiring substantiation.
suggested_rewrite: 限定具体环保属性（如可回收部件比例）并附证据，或改为中性产品特性描述。
expected_severity: MEDIUM
## sg-asas-substantiation-guidance

scope_countries: SG
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics, health.supplement, cosmetic, food
trigger_keywords: according to research, survey shows, according to a study, 调研显示, 数据显示
severity_hint: MEDIUM
decision: WARN
guidance: ASAS SCAP (Tier 1b): factual descriptions, claims, and comparisons must all be substantiable; citations of independent research must be confirmed by the research provider as accurately presented. Include the surveying institution, methodology, timing, and sample details, otherwise rewrite as a qualitative statement without third-party endorsement.
guidance_en: ASAS SCAP (Tier 1b): factual descriptions, claims, and comparisons must all be substantiable; citations of independent research must be confirmed by the research provider as accurately presented. Include the surveying institution, methodology, timing, and sample details, otherwise rewrite as a qualitative statement without third-party endorsement.
guidance_zh: ASAS SCAP（1b）：事实性描述、宣称与比较均须可举证；独立调研引用须经调研方确认呈现准确。请附调查机构、方法、时间与样本说明，否则改写为无第三方背书的定性表述。
typical_decision: REVIEW
skill_module: Claim Review
purpose: ASAS substantiation / survey-citation hygiene for Singapore ads.
suggested_rewrite: 注明调研机构、时间、样本与方法；未经调研方确认勿引用具体结论。
expected_severity: MEDIUM
## id-epi-comparative-honesty

scope_countries: ID
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics
trigger_keywords: mengungguli, kalahkan merek, jauh lebih baik dari, inferior competitor, jelek dibanding
severity_hint: MEDIUM
decision: WARN
guidance: EPI (Tier 1b) comparative advertising: comparisons may only be made under identical technical standards; methodology/source/timing must be disclosed; denigrating competitors is prohibited (Art. 1.20). Use a verifiable like-for-like comparison and cite the source.
guidance_en: EPI (Tier 1b) comparative advertising: comparisons may only be made under identical technical standards; methodology/source/timing must be disclosed; denigrating competitors is prohibited (Art. 1.20). Use a verifiable like-for-like comparison and cite the source.
guidance_zh: EPI（1b）比较广告：仅可在完全相同标准下比较技术方面；须公开方法论/来源/时间；禁止贬低竞品（1.20）。改用可核验的同维对比，并附来源。
typical_decision: REVIEW
skill_module: Claim Review
purpose: EPI comparative advertising honesty for Indonesia.
suggested_rewrite: 删除贬低竞品措辞；改为同维可核验技术对比并披露方法与来源。
expected_severity: MEDIUM
## jp-jaro-ranking-method-guidance

scope_countries: JP
scope_categories: sa.vacuum_floor, sa.steam_mop, sa.air_fryer, sa.blender_processor, sa.rice_cooker, sa.soy_milk, sa.coffee_espresso, sa.kettle_cooker, sa.other, electronics, cosmetic, health.supplement, food
trigger_keywords: 満足度調査, 調査によると, 口コミ調査, according to our survey
severity_hint: MEDIUM
decision: WARN
guidance: Premiums and Representations Act / JARO practice (Tier 1b): ranking-type claims must state the surveying organization, timing, sample size, and methodology (per the Consumer Affairs Agency's No.1 Representation Report requirements). Survey conclusions without disclosed methodology are treated as high risk.
guidance_en: Premiums and Representations Act / JARO practice (Tier 1b): ranking-type claims must state the surveying organization, timing, sample size, and methodology (per the Consumer Affairs Agency's No.1 Representation Report requirements). Survey conclusions without disclosed methodology are treated as high risk.
guidance_zh: 景品表示法 / JARO实务（1b）：排名类宣称须注明调查机构、时间、样本量与方法（消费者厅No.1表示报告要求）。未披露方法的调查结论视为高风险。
typical_decision: REVIEW
skill_module: Claim Review
purpose: JP ranking/survey method disclosure guidance aligned with JARO practice notes.
suggested_rewrite: 改为「根据[机构][年月]对[样本]的调查，在[范围]中…」并确保可出证明。
expected_severity: MEDIUM
