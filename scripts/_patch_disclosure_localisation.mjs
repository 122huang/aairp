import fs from 'node:fs';

const rulesPath = 'demo/rules.demo.json';
const pack = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

const SA_PLUS = [
  'health.supplement',
  'cosmetic',
  'food',
  'electronics',
  'sa.vacuum_floor',
  'sa.steam_mop',
  'sa.air_fryer',
  'sa.blender_processor',
  'sa.rice_cooker',
  'sa.soy_milk',
  'sa.coffee_espresso',
  'sa.kettle_cooker',
  'sa.other',
];

const BASE_ACTIVATION = [
  '品牌送的',
  '品牌送',
  '谢谢品牌',
  '赠送',
  '合作提供',
  '合作赠送',
  '安利给',
  '开箱',
  '#gifted',
  'gifted by',
  'thank you for sending',
  'thanks for sending',
  'sent me',
  'sponsored by',
  'in partnership with',
  'paid partnership',
];

const DISCLOSURE_RULES = [
  {
    rule_id: 'demo-au-sponsored-disclosure',
    summary:
      'This content is marked as influencer/partnership — confirm AANA/Ad Standards advertising identification (#ad / Ad / Paid Partnership) is added before publish. Non-blocking reminder (copy review does not verify disclosure tags).',
    summary_zh:
      '该内容标注为网红/合作，发布前需确认已添加AANA/Ad Standards广告识别标识。非阻塞提醒（文案审核不核验披露标识是否已贴）。',
    activation_terms: [...BASE_ACTIVATION, 'collab', 'affiliate link', 'gifted'],
    citation: {
      law_name: 'AANA Code of Ethics — Section 2.7 (Identifying advertising)',
      article: 'regulation:au-ad-standards-disclosure — influencer/native ad identification',
    },
  },
  {
    rule_id: 'demo-cn-sponsored-disclosure',
    summary:
      '该内容标注为网红/合作——发布前需确认已添加明显广告标识（如“广告”/对应平台广告标签）。非阻塞提醒（文案审核不核验披露标识是否已贴）。',
    summary_zh:
      '该内容标注为网红/合作——发布前需确认已添加明显广告标识（如“广告”/对应平台广告标签）。非阻塞提醒（文案审核不核验披露标识是否已贴）。',
    activation_terms: [
      ...BASE_ACTIVATION,
      '种草',
      '好物推荐',
      '商业合作',
      '广告合作',
      '软广',
    ],
    citation: {
      law_name: '广告法第二十八条；互联网广告管理办法 — 广告标识义务',
      article: '网红/付费推广须显著标明“广告”；创意审核阶段仅提醒发布前贴标',
    },
  },
  {
    rule_id: 'demo-jp-sponsored-disclosure',
    summary:
      'This content is marked as influencer/partnership — confirm stealth-marketing disclosure (#PR / 広告 / platform ad label) is added before publish. Non-blocking reminder (copy review does not verify disclosure tags).',
    summary_zh:
      '该内容标注为网红/合作，发布前需确认已添加日本隐性营销披露标识（#PR / 広告等）。非阻塞提醒（文案审核不核验披露标识是否已贴）。',
    activation_terms: [
      ...BASE_ACTIVATION,
      '提供',
      '案件',
      'タイアップ',
      'PR案件',
      '#PR',
      '広告',
    ],
    citation: {
      law_name: 'Stealth Marketing Guidelines (CAA) — Section 3',
      article: 'regulation:jp-caa-sponsored-disclosure — paid endorsement identification',
    },
  },
  {
    rule_id: 'demo-kr-sponsored-disclosure',
    summary:
      'This content is marked as influencer/partnership — confirm KFTC advertising disclosure (#광고 / 협찬 / platform ad label) is added before publish. Non-blocking reminder (copy review does not verify disclosure tags).',
    summary_zh:
      '该内容标注为网红/合作，发布前需确认已添加KFTC广告披露标识（#광고 / 협찬等）。非阻塞提醒（文案审核不核验披露标识是否已贴）。',
    activation_terms: [
      ...BASE_ACTIVATION,
      '협찬',
      '광고',
      '#광고',
      '유료광고',
      '제공받음',
    ],
    citation: {
      law_name: 'Guidelines on Labeling and Advertising — Article 5 (KFTC)',
      article: 'regulation:kr-kftc-ad-disclosure — commercial message identification',
    },
  },
];

function upsertRule(rule) {
  const idx = pack.rules.findIndex((r) => r.rule_id === rule.rule_id);
  if (idx >= 0) {
    pack.rules[idx] = rule;
    console.log('update', rule.rule_id);
  } else {
    pack.rules.push(rule);
    console.log('insert', rule.rule_id);
  }
}

for (const def of DISCLOSURE_RULES) {
  const country = def.rule_id.split('-')[1].toUpperCase();
  upsertRule({
    rule_id: def.rule_id,
    rule_version_id: `${def.rule_id}-v1`,
    severity: 'LOW',
    decision: 'INFO',
    summary: def.summary,
    required_any_mode: 'influencer_or_activation',
    activation_terms: def.activation_terms,
    when: {
      ad_type_in: ['INFLUENCER_UGC'],
      or_missing_ad_type: true,
    },
    scopes: {
      countries: [country],
      categories: SA_PLUS,
    },
    citation: def.citation,
    summary_en: def.summary,
    summary_zh: def.summary_zh,
    remediation_type: 'NOT_APPLICABLE_DISCLOSURE',
  });
}

// AU: SEA-style wrong-language / cert mismatch + CJK OCR checks apply.
for (const id of ['demo-apac-sa-localization', 'demo-apac-sa-localization-cjk']) {
  const rule = pack.rules.find((r) => r.rule_id === id);
  if (!rule) continue;
  const set = new Set(rule.scopes.countries);
  set.add('AU');
  rule.scopes.countries = ['SG', 'MY', 'TH', 'AU', ...[...set].filter((c) => !['SG', 'MY', 'TH', 'AU'].includes(c))];
  if (id === 'demo-apac-sa-localization') {
    rule.citation = {
      law_name:
        'SG: CPFTA 2003 s.4; MY: TDA 2011 s.18; TH: CPA B.E.2522 s.47-48; AU: Australian Consumer Law Sch 2 s 18',
      article: 'Localization — market-appropriate assets / language / cert marks',
    };
    if (!rule.trigger_terms.includes('incorrect for australia market')) {
      rule.trigger_terms.push('incorrect for australia market', 'wrong voltage for au');
    }
  } else {
    rule.summary =
      'Image OCR contains Chinese/CJK text — verify market-appropriate localized assets for SG/MY/TH/AU listings';
    rule.summary_en = rule.summary;
    rule.summary_zh =
      '图片OCR识别出中文/CJK文字——请核实SG/MY/TH/AU市场listing使用的是否为适配当地市场的本地化素材';
    rule.citation = {
      law_name:
        'SG: CPFTA 2003 s.4; MY: TDA 2011 s.18; TH: CPA B.E.2522 s.47-48; AU: Australian Consumer Law Sch 2 s 18',
      article: 'Localization — CJK in image OCR (not applied to CN/JP/KR native scripts)',
    };
  }
  console.log('scope', id, rule.scopes.countries.join(','));
}

// CN/JP/KR (+AU): universal draft/placeholder localisation without CJK false positives.
upsertRule({
  rule_id: 'demo-apac-sa-localization-draft',
  rule_version_id: 'demo-apac-sa-localization-draft-v1',
  severity: 'MEDIUM',
  decision: 'WARN',
  summary:
    'Draft/placeholder localisation residue in ad copy (TBD markers, insert-claim stubs, unresolved confirmation notes) — fix before publish (WARN)',
  trigger_terms: [
    '[tbd]',
    '[insert claim here]',
    '[insert]',
    '待确认',
    '待补充',
    '占位',
    'placeholder text',
    'lorem ipsum',
    'xxx产品名',
    '【待翻译】',
  ],
  scopes: {
    countries: ['AU', 'CN', 'JP', 'KR'],
    categories: [
      'sa.vacuum_floor',
      'sa.steam_mop',
      'sa.air_fryer',
      'sa.blender_processor',
      'sa.rice_cooker',
      'sa.soy_milk',
      'sa.coffee_espresso',
      'sa.kettle_cooker',
      'sa.other',
      'electronics',
    ],
  },
  citation: {
    law_name:
      'AU: ACL Sch 2 s 18; CN: 广告法第九条/第二十八条; JP: 景品表示法 s.5; KR: Fair Labeling and Advertising Act Art. 3',
    article: 'Localization — draft/placeholder residue (CJK OCR checks intentionally excluded for CN/JP/KR)',
  },
  summary_en:
    'Draft/placeholder localisation residue in ad copy (TBD markers, insert-claim stubs, unresolved confirmation notes) — fix before publish (WARN)',
  summary_zh: '广告文案残留草稿/占位符（TBD、待插入宣称、待确认等）——发布前须修正（WARN）',
  remediation_type: 'REWRITE_ONLY',
});

const m = String(pack.pack_version).match(/^(demo-rule-1\.8\.)(\d+)$/);
pack.pack_version = m ? `${m[1]}${Number(m[2]) + 1}` : 'demo-rule-1.8.12';
fs.writeFileSync(rulesPath, `${JSON.stringify(pack, null, 2)}\n`);
console.log('pack=', pack.pack_version);
