/**
 * Semi-auto coverage matrix: claim family × market × rule / playbook / open-risk / gaps.
 * Handbook Ch.5 claim families are approximated from Open Risk taxonomy + APAC-SA rule classes
 * (handbook lives outside repo; matrix notes the comparison edition).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LEGAL_REVIEWED = new Set(['SG', 'MY', 'TH', 'ID', 'JP', 'KR', 'AU', 'CN']);
const PRODUCT_UI = ['SG', 'MY', 'TH', 'AU', 'CN', 'JP', 'KR'];
const DEFERRED = ['ID', 'IN'];
const UNREVIEWED = ['VN', 'PH'];
const MARKETS = [...PRODUCT_UI, ...DEFERRED, ...UNREVIEWED];

/** Claim families aligned to handbook Ch.5 / Open Risk risk_type taxonomy. */
const CLAIM_FAMILIES = [
  {
    id: 'medical-health-claim',
    handbook_ref: 'Ch.5 / market卡·健康/医疗宣称',
    rule_match: [/health-claim/, /health-forbidden/, /food-safety/, /yakukiho/, /efficacy/],
    playbook_match: [/health-claim/, /sa-health/, /medical/],
    open_risk: ['medical-claim'],
  },
  {
    id: 'health-implication',
    handbook_ref: 'Ch.5 / 健康隐含',
    rule_match: [/health-implication/],
    playbook_match: [/health-implication/, /sa-health-implication/],
    open_risk: ['health-implication'],
  },
  {
    id: 'absolute-superlative',
    handbook_ref: 'Ch.5 / 绝对化用语',
    rule_match: [/absolute-claim/, /absolute-terms/],
    playbook_match: [/absolute/, /superlative/, /sa-absolute/],
    open_risk: ['absolute-claim-blocker'],
  },
  {
    id: 'performance-capacity',
    handbook_ref: 'Ch.5 / 性能与容量',
    rule_match: [/performance-claim/, /capacity-claim/, /performance-data/],
    playbook_match: [/performance/, /capacity/, /sa-performance/],
    open_risk: [],
  },
  {
    id: 'comparative-claim',
    handbook_ref: 'Ch.5 / 比较宣称',
    rule_match: [/comparative/],
    playbook_match: [/comparative/, /sa-comparative/],
    open_risk: ['comparative-claim'],
  },
  {
    id: 'certification-evidence',
    handbook_ref: 'Ch.5 / 认证与证据',
    rule_match: [/certification/, /evidence-unreadable/, /cpsr/, /coe/, /halal/, /tisi/, /rcm/],
    playbook_match: [/certification/, /substantiation/, /evidence/],
    open_risk: ['certification-evidence'],
  },
  {
    id: 'false-authority',
    handbook_ref: 'Ch.5 / 虚假权威/官方背书',
    rule_match: [/false-authority/, /false-official/, /endorsement/],
    playbook_match: [/authority/, /endorsement/],
    open_risk: [],
  },
  {
    id: 'sustainability-environment',
    handbook_ref: 'Ch.5 / 环保/可持续',
    rule_match: [/sustainability/, /environmental/, /green/],
    playbook_match: [/sustainab/, /environment/, /green/],
    open_risk: ['environmental-claim'],
  },
  {
    id: 'scarcity-urgency',
    handbook_ref: 'Ch.5 / 稀缺紧迫',
    rule_match: [/urgency-scarcity/, /scarcity/],
    playbook_match: [/urgency/, /scarcity/],
    open_risk: ['scarcity-urgency-claim'],
  },
  {
    id: 'sponsored-disclosure',
    handbook_ref: 'Ch.5 / 赞助披露',
    rule_match: [/sponsored-disclosure/],
    playbook_match: [/sponsored/, /disclosure/],
    open_risk: ['sponsored-disclosure'],
  },
  {
    id: 'localisation',
    handbook_ref: 'Ch.5 / 本地化',
    rule_match: [/localization/],
    playbook_match: [/locali[sz]/],
    open_risk: ['localisation-error'],
  },
  {
    id: 'before-after-imagery',
    handbook_ref: 'Ch.5 / 前后对比图',
    rule_match: [/before-after/],
    playbook_match: [/before-after/],
    open_risk: [],
  },
  {
    id: 'analogy-claim',
    handbook_ref: 'Ch.5 / 类比宣称',
    rule_match: [/analogy/],
    playbook_match: [/analog/],
    open_risk: ['analogical-claim'],
  },
  {
    id: 'pricing-misrepresentation',
    handbook_ref: 'Ch.5 / 价格误导',
    rule_match: [/pricing/],
    playbook_match: [/pricing/, /price/],
    open_risk: [],
  },
  {
    id: 'sensitive-content',
    handbook_ref: 'Ch.5 / 敏感内容（CN等）',
    rule_match: [/sensitive-content/],
    playbook_match: [/sensitive/],
    open_risk: ['sensitive-content-flag'],
  },
];

function loadRules() {
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'demo/rules.demo.json'), 'utf8'));
  return { packVersion: pack.pack_version, rules: pack.rules };
}

function loadPlaybookPatterns() {
  const md = fs.readFileSync(path.join(ROOT, 'demo/playbook.demo.md'), 'utf8');
  const patterns = [];
  const blocks = md.split(/\n## /).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const id = lines[0].trim();
    const countriesLine = lines.find((l) => l.startsWith('scope_countries:'));
    const countries = countriesLine
      ? countriesLine
          .replace('scope_countries:', '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    patterns.push({ id, countries });
  }
  return patterns;
}

function loadOpenRiskTypes() {
  const txt = fs.readFileSync(path.join(ROOT, 'demo/open-risk.prompt.txt'), 'utf8');
  const types = new Set();
  for (const m of txt.matchAll(/`([a-z0-9-]+-(?:claim|blocker|evidence|flag|error|disclosure)[a-z0-9-]*)`/gi)) {
    types.add(m[1]);
  }
  // known taxonomy anchors
  for (const t of [
    'medical-claim',
    'absolute-claim-blocker',
    'certification-evidence',
    'health-implication',
    'comparative-claim',
    'analogical-claim',
    'environmental-claim',
    'localisation-error',
    'sponsored-disclosure',
    'scarcity-urgency-claim',
    'sensitive-content-flag',
  ]) {
    if (txt.includes(t)) types.add(t);
  }
  return types;
}

function matchesAny(id, regexes) {
  return regexes.some((re) => re.test(id));
}

function cellStatus({ rules, playbooks, openRiskHit, market }) {
  const hard = rules.some((r) => r.severity === 'BLOCKER' || r.decision === 'FAIL');
  const hasRule = rules.length > 0;
  const hasPb = playbooks.length > 0;
  if (!hasRule && !hasPb && !openRiskHit) return 'GAP';
  if (!hasRule && (hasPb || openRiskHit)) return 'SOFT_ONLY';
  if (hasRule && !hard && (market === 'AU' || market === 'CN' || market === 'JP' || market === 'KR')) {
    // local rules may exist but APAC hard layer matters — still covered if any rule
  }
  if (hasRule) return hard ? 'HARD' : 'RULE';
  return 'SOFT_ONLY';
}

function buildMatrix() {
  const { packVersion, rules } = loadRules();
  const playbooks = loadPlaybookPatterns();
  const openRiskTypes = loadOpenRiskTypes();

  const rows = [];
  for (const family of CLAIM_FAMILIES) {
    for (const market of MARKETS) {
      const matchedRules = rules.filter(
        (r) =>
          (r.scopes?.countries || []).includes(market) && matchesAny(r.rule_id, family.rule_match),
      );
      const matchedPb = playbooks.filter(
        (p) => p.countries.includes(market) && matchesAny(p.id, family.playbook_match),
      );
      const openRiskHit = family.open_risk.some((t) => openRiskTypes.has(t));
      const status = cellStatus({
        rules: matchedRules,
        playbooks: matchedPb,
        openRiskHit,
        market,
      });
      const legalReviewed = LEGAL_REVIEWED.has(market);
      const tier = PRODUCT_UI.includes(market)
        ? 'product_ui'
        : DEFERRED.includes(market)
          ? 'deferred'
          : 'unreviewed_demo';

      let gapNote = '';
      if (status === 'GAP') gapNote = '手册侧有宣称类型，但该市场无 rule/playbook 命中（Open Risk 也可能全局有分类）';
      if (status === 'SOFT_ONLY') gapNote = '仅有 Playbook 和/或 Open Risk，无确定性 Rule';
      if (family.id === 'before-after-imagery' && status === 'GAP') {
        gapNote = 'Playbook/Rule 均未覆盖 before-after-imagery';
      }
      if (
        family.id === 'localisation' &&
        ['CN', 'JP', 'KR'].includes(market) &&
        matchedRules.some((r) => r.rule_id.includes('localization-cjk'))
      ) {
        gapNote = 'CJK localization 规则故意不挂 CN/JP/KR，避免母语误报';
      }
      if (['AU', 'CN', 'JP', 'KR'].includes(market) && matchedRules.length > 0) {
        const cites = matchedRules.map((r) => r.citation?.law_name || '');
        const marketTag =
          market === 'AU'
            ? /AU:|Australian Consumer Law|ACL|AANA/
            : market === 'CN'
              ? /CN:|广告法|互联网广告/
              : market === 'JP'
                ? /JP:|景品表示|Stealth Marketing|CAA/
                : /KR:|Fair Labeling|공정화|KFTC|Labeling and Advertising/;
        // Per-country rules (scopes.countries === [market]) count as cited for that market.
        const hasLocalRule = matchedRules.some(
          (r) =>
            Array.isArray(r.scopes?.countries) &&
            r.scopes.countries.length === 1 &&
            r.scopes.countries[0] === market,
        );
        const missingMarketCite = !hasLocalRule && cites.every((c) => !marketTag.test(c));
        const demoCite = cites.length > 0 && cites.every((c) => /\(Demo\)|APAC Advertising Standards/.test(c));
        if (missingMarketCite || demoCite) {
          const msg = demoCite
            ? 'Rule 已覆盖；citation 仍为 Demo 占位'
            : `Rule 已覆盖；citation 尚未含 ${market} 法条（待按国拆分或补多市场引用）`;
          if (!gapNote) gapNote = msg;
          else if (!gapNote.includes('citation')) gapNote += `；${msg.replace('Rule 已覆盖；', '')}`;
        }
      }

      rows.push({
        claim_family: family.id,
        handbook_ref: family.handbook_ref,
        market,
        legal_reviewed: legalReviewed,
        market_tier: tier,
        status,
        rule_ids: matchedRules.map((r) => r.rule_id),
        playbook_ids: matchedPb.map((p) => p.id),
        open_risk_types: family.open_risk.filter((t) => openRiskTypes.has(t)),
        gap_note: gapNote,
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    handbook_edition: '全球广告合规法务审核规则手册_v0.9（外部 OneDrive；Ch.5 宣称类型按 taxonomy 近似映射）',
    rules_pack_version: packVersion,
    product_ui_markets: PRODUCT_UI,
    deferred_markets: DEFERRED,
    unreviewed_markets: UNREVIEWED,
    rows,
  };
}

function toMarkdown(matrix) {
  const lines = [];
  lines.push('# 市场规则覆盖矩阵（初版）');
  lines.push('');
  lines.push(`- 生成时间：${matrix.generated_at}`);
  lines.push(`- 手册对照：${matrix.handbook_edition}`);
  lines.push(`- Rules pack：\`${matrix.rules_pack_version}\``);
  lines.push(`- 产品 UI 市场：${matrix.product_ui_markets.join(', ')}`);
  lines.push(`- 暂缓：${matrix.deferred_markets.join(', ')}；未法务背书：${matrix.unreviewed_markets.join(', ')}（降权，不得与已审市场同置信）`);
  lines.push('- 再生：`node scripts/_gen_coverage_matrix.mjs`');
  lines.push('');
  lines.push('## 状态图例');
  lines.push('');
  lines.push('| 状态 | 含义 |');
  lines.push('|---|---|');
  lines.push('| HARD | 有 BLOCKER/FAIL 级 Rule |');
  lines.push('| RULE | 有确定性 Rule（非 BLOCKER） |');
  lines.push('| SOFT_ONLY | 仅 Playbook 和/或 Open Risk |');
  lines.push('| GAP | 该市场无 rule/playbook 命中 |');
  lines.push('');
  lines.push('## 产品 UI 市场摘要（缺口优先）');
  lines.push('');
  lines.push('| 宣称类型 | SG | MY | TH | AU | CN | JP | KR | 缺口说明 |');
  lines.push('|---|---|---|---|---|---|---|---|---|');

  const families = [...new Set(matrix.rows.map((r) => r.claim_family))];
  for (const fam of families) {
    const cells = PRODUCT_UI.map((m) => {
      const row = matrix.rows.find((r) => r.claim_family === fam && r.market === m);
      return row?.status ?? '?';
    });
    const notes = matrix.rows
      .filter((r) => r.claim_family === fam && PRODUCT_UI.includes(r.market) && r.gap_note)
      .map((r) => `${r.market}:${r.gap_note}`)
      .slice(0, 3)
      .join('；');
    lines.push(`| ${fam} | ${cells.join(' | ')} | ${notes || '—'} |`);
  }

  lines.push('');
  lines.push('## 降权市场（VN/PH）与暂缓（ID/IN）');
  lines.push('');
  lines.push('| 宣称类型 | ID | IN | VN | PH |');
  lines.push('|---|---|---|---|---|');
  for (const fam of families) {
    const cells = ['ID', 'IN', 'VN', 'PH'].map((m) => {
      const row = matrix.rows.find((r) => r.claim_family === fam && r.market === m);
      const mark =
        row && (UNREVIEWED.includes(row.market) || row.market === 'IN')
          ? `${row.status}*`
          : row?.status;
      return mark ?? '?';
    });
    lines.push(`| ${fam} | ${cells.join(' | ')} |`);
  }
  lines.push('');
  lines.push(
    '\\* VN/PH：`legal_reviewed=false`（无市场卡）；IN：手册有卡但引擎注册表未纳入 `LEGAL_REVIEWED`——均不得与产品 UI 同等置信。',
  );
  lines.push('');
  lines.push('## 明细（JSON 同源）');
  lines.push('');
  lines.push('完整行数据见同目录 `coverage-matrix.json`。');
  lines.push('');
  lines.push('### 优先补齐清单（从本矩阵导出）');
  lines.push('');
  const priorities = matrix.rows.filter(
    (r) =>
      PRODUCT_UI.includes(r.market) &&
      (r.status === 'GAP' || r.status === 'SOFT_ONLY' || (r.gap_note && r.gap_note.includes('citation'))),
  );
  const seen = new Set();
  for (const r of priorities) {
    const key = `${r.claim_family}|${r.status}|${r.gap_note}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- **${r.claim_family}** @ ${r.market} → \`${r.status}\`${r.gap_note ? ` — ${r.gap_note}` : ''}`);
  }
  return `${lines.join('\n')}\n`;
}

const outDir = path.join(ROOT, 'docs/knowledge/compiler');
fs.mkdirSync(outDir, { recursive: true });
const matrix = buildMatrix();
fs.writeFileSync(path.join(outDir, 'coverage-matrix.json'), `${JSON.stringify(matrix, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'coverage-matrix.md'), toMarkdown(matrix));
console.log('wrote', path.join(outDir, 'coverage-matrix.md'));
console.log(
  'product gaps/soft:',
  matrix.rows.filter((r) => PRODUCT_UI.includes(r.market) && (r.status === 'GAP' || r.status === 'SOFT_ONLY')).length,
);
