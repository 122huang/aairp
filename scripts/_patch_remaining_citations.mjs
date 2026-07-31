import fs from 'node:fs';

const rulesPath = 'demo/rules.demo.json';
const pack = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

const MULTI = {
  law_name:
    'SG: Consumer Protection (Fair Trading) Act 2003 s.4 & Second Schedule; MY: Trade Descriptions Act 2011 s.18; TH: Consumer Protection Act B.E.2522 s.47-48; AU: Australian Consumer Law Sch 2 s 18; CN: 广告法（2021年第二次修正）第九条/第二十八条; JP: 景品表示法（不当景品類及び不当表示防止法）第5条; KR: 표시·광고의 공정화에 관한 법률 Art. 3/7',
  article:
    '各国具体条款与处罚详见手册 8.x 及法规来源台账.md；多市场共用引用（对外 demo 须法务 sign-off 或 disclaimer）',
};

const TARGETS = new Set([
  'demo-apac-sa-health-implication',
  'demo-apac-sa-false-authority-endorsement',
  'demo-apac-sa-pricing-misrepresentation',
  'demo-apac-sa-analogy-claim',
  'demo-apac-sa-sustainability-claim',
  'demo-apac-sa-certification-evidence',
  'demo-apac-sa-urgency-scarcity-claim',
  'demo-apac-sa-capacity-claim',
  'demo-apac-sa-absolute-claim-soft',
  'demo-apac-sa-social-proof-claim',
]);

let n = 0;
for (const rule of pack.rules) {
  if (!TARGETS.has(rule.rule_id)) continue;
  rule.citation = { ...MULTI };
  n += 1;
  console.log('citation', rule.rule_id);
}

const m = String(pack.pack_version).match(/^(demo-rule-1\.8\.)(\d+)$/);
pack.pack_version = m ? `${m[1]}${Number(m[2]) + 1}` : 'demo-rule-1.8.13';
fs.writeFileSync(rulesPath, `${JSON.stringify(pack, null, 2)}\n`);
console.log('updated', n, 'pack=', pack.pack_version);
