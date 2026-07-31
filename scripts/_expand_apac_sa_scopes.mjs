import fs from 'node:fs';

const rulesPath = 'demo/rules.demo.json';
const pack = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

/** SEA-local asset checks — must not fire on CN/JP/KR native CJK listings. */
const SKIP = new Set([
  'demo-apac-sa-localization',
  'demo-apac-sa-localization-cjk',
  'demo-apac-sa-urgency-scarcity-claim', // already multi-market
]);

const EXTRA = ['AU', 'CN', 'JP', 'KR'];
const ORDER = ['SG', 'MY', 'TH', 'AU', 'CN', 'JP', 'KR', 'ID', 'VN', 'PH', 'IN'];

let expanded = 0;
for (const rule of pack.rules) {
  if (!String(rule.rule_id).startsWith('demo-apac-sa-')) continue;
  if (SKIP.has(rule.rule_id)) {
    console.log('skip', rule.rule_id, rule.scopes.countries.join(','));
    continue;
  }
  const before = rule.scopes.countries.slice();
  const set = new Set(before);
  for (const c of EXTRA) set.add(c);
  rule.scopes.countries = ORDER.filter((c) => set.has(c)).concat(
    [...set].filter((c) => !ORDER.includes(c)),
  );
  if (JSON.stringify(before) !== JSON.stringify(rule.scopes.countries)) {
    expanded += 1;
    console.log('expand', rule.rule_id, before.join(','), '->', rule.scopes.countries.join(','));
  }
}

const m = String(pack.pack_version).match(/^(demo-rule-1\.8\.)(\d+)$/);
pack.pack_version = m ? `${m[1]}${Number(m[2]) + 1}` : 'demo-rule-1.8.10';

fs.writeFileSync(rulesPath, `${JSON.stringify(pack, null, 2)}\n`);
console.log('done expanded=', expanded, 'pack=', pack.pack_version);
