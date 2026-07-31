/**
 * Citation sign-off pass 1 — per reconciled review (not GPT's full rule-split demand):
 * - A: strip Demo; bind corpus-backed law names
 * - B: remove "见手册" articles; fix trademark/food-safety domain mismatch;
 *      keep multi-market rule_ids with per-country segments in law_name
 */
import fs from 'node:fs';

const path = 'demo/rules.demo.json';
const pack = JSON.parse(fs.readFileSync(path, 'utf8'));

const MULTI_CONSUMER = {
  law_name:
    'SG: Consumer Protection (Fair Trading) Act 2003 s.4 & Second Schedule; MY: Trade Descriptions Act 2011 s.18; TH: Consumer Protection Act B.E.2522 s.47-48; AU: Australian Consumer Law Sch 2 s 18; CN: 广告法（2021年第二次修正）第九条/第二十八条; JP: 景品表示法（不当景品類及び不当表示防止法）第5条; KR: 표시·광고의 공정화에 관한 법률 Art. 3/7',
};

/** @type {Record<string, { law_name: string; article: string }>} */
const CITATIONS = {
  // ----- Batch A -----
  'demo-sg-health-forbidden-claim': {
    law_name: 'Health Products Act (Singapore)',
    article:
      'Section 7 — Prohibited claims (cure / miracle / absolute efficacy for health products; scope: health.supplement) — regulation:sg-hpa-s7-prohibited-claims',
  },
  'demo-sg-sponsored-disclosure': {
    law_name: 'Advertising Standards Authority of Singapore (ASAS) / Singapore Code of Advertising Practice',
    article: 'SCAP Rule 2.4 — Influencer / sponsored content must be clearly identified as advertising',
  },
  'demo-my-sponsored-disclosure': {
    law_name:
      'Communications and Multimedia Content Code (MCMC) + Malaysian Code of Advertising Practice (ASA Malaysia)',
    article:
      'Advertising identification / influencer disclosure (#ad, #sponsored, Paid Partnership); brand may bear vicarious liability for undisclosed paid content — regulation:my-masa-sponsorship-disclosure',
  },
  'demo-th-sponsored-disclosure': {
    law_name: 'OCPB Guidelines on Identification of Advertisements',
    article:
      'Article 3 — Sponsored online / social content must be clearly labeled as advertising — regulation:th-ocpb-ad-identification',
  },
  'demo-sg-sa-market-claim': {
    law_name: 'Singapore Code of Advertising Practice (SCAP / ASAS)',
    article:
      'Truthful presentation / substantiation of local ranking & endorsement claims — must not imply official medical endorsement',
  },
  'demo-my-sa-market-claim': {
    law_name: 'Malaysian Code of Advertising Practice (ASA Malaysia)',
    article:
      'Misleading claims / substantiation of ranking & authority endorsement claims — must not imply official medical or government endorsement',
  },
  'demo-th-sa-market-claim': {
    law_name: 'Consumer Protection Act B.E.2522 (Thailand) + OCPB advertising guidance',
    article:
      'Misleading advertisement provisions — local ranking / government-health-authority endorsement claims require substantiation',
  },

  // ----- Batch B (shared APAC-SA; no rule_id split this pass) -----
  'demo-apac-sa-absolute-claim': {
    ...MULTI_CONSUMER,
    article:
      'Absolute / omnibus superiority claims without verifiable basis — SG CPFTA s.4 Second Schedule; MY TDA s.18; TH CPA s.47-48; AU ACL s.18; CN 广告法第九条; JP 景品表示法 s.5; KR Fair Labeling Art. 3/7',
  },
  'demo-apac-sa-health-claim-blocker': {
    law_name:
      'SG: SCAP (ASAS) health/medical claim standards + CPFTA s.4; MY: Trade Descriptions Act 2011 s.18 + advertising code health-claim hygiene; TH: CPA B.E.2522 s.47-48; AU: ACL Sch 2 s 18 + AANA/therapeutic boundary hygiene; CN: 广告法第九条/第二十八条; JP: 景品表示法 s.5 + 薬機法 efficacy boundary hygiene; KR: Fair Labeling Art. 3/7',
    article:
      'Disease / organ-function / clinical-metric / medical-endorsement claims on small appliances — prohibited or require specialty regime; not cured by general substantiation alone',
  },
  'demo-apac-sa-health-implication': {
    law_name:
      'SG: SCAP substantiation / health-implication hygiene + CPFTA s.4; MY: TDA 2011 s.18; TH: CPA B.E.2522 s.47-48; AU: ACL Sch 2 s 18; CN: 广告法第二十八条; JP: 景品表示法 s.5; KR: Fair Labeling Art. 3/7',
    article:
      'Implied health / nutrition benefit without conditions or evidence — MANUAL_REVIEW / qualify wording (not a soft WARN-only path)',
  },
  'demo-apac-sa-performance-claim': {
    ...MULTI_CONSUMER,
    article:
      'Quantified performance claims require objective substantiation (test conditions / method / scope) — misleading if unsubstantiated',
  },
  'demo-apac-sa-comparative-claim': {
    law_name:
      'SG: SCAP comparative advertising + CPFTA s.4; MY: TDA 2011 s.18 + MASA comparative hygiene; TH: CPA B.E.2522 / OCPB comparative ads guidance; AU: ACL Sch 2 s 18 + ACCC comparative advertising; CN: 广告法; JP: 景品表示法 s.5 comparative representations; KR: Monopoly Regulation and Fair Trade Act Art. 23 / Fair Labeling',
    article:
      'Comparative superiority claims must be objective, substantiated, and non-denigrating',
  },
  'demo-apac-sa-certification-evidence': {
    law_name:
      'SG: SCAP claims substantiation + CPFTA s.4; MY: TDA 2011 s.18; TH: CPA B.E.2522; AU: ACL Sch 2 s 18; CN: 广告法第十一条（证明文件 / 真实性）; JP: 景品表示法 s.5; KR: Fair Labeling Art. 3/7',
    article:
      'Certification / lab / HEPA-class evidence references require authentic, in-scope documentary support — tool cannot verify certificate authenticity',
  },
  'demo-apac-sa-content-consistency-blocker': {
    ...MULTI_CONSUMER,
    article:
      'Material inconsistency across ad text / images / claims that renders the representation misleading',
  },
  'demo-apac-sa-false-authority-endorsement': {
    law_name:
      'SG: CPFTA s.4 + SCAP endorsement hygiene; MY: TDA 2011 s.18; TH: CPA B.E.2522; AU: ACL Sch 2 s 18; CN: 广告法第九条/第二十八条（虚假官方背书）; JP: 景品表示法 s.5; KR: Fair Labeling Art. 3/7',
    article:
      'False or unverified government / ministry / official certification endorsement',
  },
  'demo-apac-sa-competitor-trademark': {
    law_name:
      'SG: Trade Marks Act 1998 (+ passing off / CPFTA misleading where branding confuses); MY: Trade Marks Act 2019; TH: Trademark Act B.E.2534 (as amended); AU: Trade Marks Act 1995; CN: 商标法 + 反不正当竞争法; JP: 商標法 + 不正競争防止法; KR: Trademark Act + Unfair Competition Prevention Act',
    article:
      'Unauthorised use of competitor brand, logo, product appearance, or registered mark in advertising',
  },
  'demo-apac-sa-food-safety-blocker': {
    law_name:
      'SG: Sale of Food Act / Food Regulations (unsafe food depiction / handling representations); MY: Food Act 1983; TH: Food Act B.E.2522; AU: Food Standards Australia New Zealand / ACL misleading where unsafe practices contradicted; CN: 食品安全法 + 广告法; JP: 食品衛生法 hygiene representation hygiene; KR: Food Sanitation Act advertising hygiene',
    article:
      'Depicting prolonged unrefrigerated raw meat/seafood/eggs before cooking as normal practice — food-safety hazard representation',
  },
  'demo-apac-sa-pricing-misrepresentation': {
    ...MULTI_CONSUMER,
    article:
      'False reference price / perpetual flash sale / bait pricing / checkout total mismatch — misleading price representation',
  },
};

let n = 0;
for (const rule of pack.rules) {
  const next = CITATIONS[rule.rule_id];
  if (!next) continue;
  rule.citation = { ...next };
  n += 1;
  console.log('citation', rule.rule_id);
}

const m = String(pack.pack_version).match(/^(demo-rule-1\.8\.)(\d+)$/);
pack.pack_version = m ? `${m[1]}${Number(m[2]) + 1}` : 'demo-rule-1.8.14';
fs.writeFileSync(path, `${JSON.stringify(pack, null, 2)}\n`);
console.log('updated', n, 'pack=', pack.pack_version);
