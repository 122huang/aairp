import fs from 'node:fs';

const rulesPath = 'demo/rules.demo.json';
const pack = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

const MULTI_MARKET_CITATION = {
  law_name:
    'SG: Consumer Protection (Fair Trading) Act 2003 s.4 & Second Schedule; MY: Trade Descriptions Act 2011 s.18; TH: Consumer Protection Act B.E.2522 s.47-48; AU: Australian Consumer Law Sch 2 s 18; CN: 广告法（2021年第二次修正）第九条/第二十八条; JP: 景品表示法（不当景品類及び不当表示防止法）第5条; KR: 표시·광고의 공정화에 관한 법률 Art. 3/7',
  article:
    '各国具体条款与处罚详见手册 8.x 及法规来源台账.md；高频宣称类共用多市场引用（待后续按国拆 rule）',
};

const HIGH_FREQ = new Set([
  'demo-apac-sa-health-claim-blocker',
  'demo-apac-sa-absolute-claim',
  'demo-apac-sa-performance-claim',
  'demo-apac-sa-comparative-claim',
]);

for (const rule of pack.rules) {
  if (HIGH_FREQ.has(rule.rule_id)) {
    rule.citation = { ...MULTI_MARKET_CITATION };
    console.log('citation', rule.rule_id);
  }
}

if (pack.rules.some((r) => r.rule_id === 'demo-apac-sa-before-after-imagery')) {
  console.log('before-after already present — skip insert');
} else {
  const saCategories = [
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
  ];
  pack.rules.push({
    rule_id: 'demo-apac-sa-before-after-imagery',
    rule_version_id: 'demo-apac-sa-before-after-imagery-v1',
    severity: 'LOW',
    decision: 'WARN',
    summary:
      'Before/after or transformation claim detected — require typicality disclaimer; must not imply guaranteed outcomes (WARN)',
    trigger_terms: [
      'before and after',
      'before/after',
      'before & after',
      'before after',
      'transformation',
      '前后对比',
      '使用前',
      '使用后',
      '对比图',
      '效果对比',
    ],
    scopes: {
      countries: ['SG', 'MY', 'TH', 'AU', 'CN', 'JP', 'KR'],
      categories: saCategories,
    },
    citation: {
      law_name:
        'SG: Singapore Code of Advertising Practice Rule 4.2 (Before/after imagery); MY: Trade Descriptions Act 2011 s.18; TH: CPA B.E.2522 s.47-48; AU: ACL Sch 2 s 18; CN: 广告法第二十八条; JP: 景品表示法 s.5; KR: Fair Labeling and Advertising Act Art. 3',
      article:
        'Before/after imagery — typicality disclaimer; see regulation:sg-asas-before-after-imagery',
    },
    summary_en:
      'Before/after or transformation claim detected — require typicality disclaimer; must not imply guaranteed outcomes (WARN)',
    summary_zh: '检测到前后对比或效果转变类宣称——须加典型效果免责声明，避免暗示效果必然达成（WARN）',
    remediation_type: 'REWRITE_ONLY',
  });
  console.log('inserted demo-apac-sa-before-after-imagery');
}

const m = String(pack.pack_version).match(/^(demo-rule-1\.8\.)(\d+)$/);
pack.pack_version = m ? `${m[1]}${Number(m[2]) + 1}` : 'demo-rule-1.8.11';

fs.writeFileSync(rulesPath, `${JSON.stringify(pack, null, 2)}\n`);
console.log('pack=', pack.pack_version);
