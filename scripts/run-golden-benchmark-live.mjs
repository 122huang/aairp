/**
 * Live API runner for AAIRP Golden Benchmark Dataset v1.0 (text-extractable cases).
 * Usage: node scripts/run-golden-benchmark-live.mjs [baseUrl] [casesJsonPath]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const casesPath =
  process.argv[3] ??
  join(dirname(fileURLToPath(import.meta.url)), 'golden-benchmark-v1-cases.json');
const outPath = process.argv[4] ?? 'pilot/results/golden-benchmark-v1-live.json';

/** @type {Array<{id:string, text:string, risk:string, expected:'REJECT'|'REVIEW'|'REVIEW_OR_REJECT', issue:string, modality:'text'|'image'|'video'|'doc'}>} */
const CASES = JSON.parse(readFileSync(casesPath, 'utf8'));

function mapGoldenToEngine(expected) {
  if (expected === 'REJECT') return ['REJECT'];
  if (expected === 'REVIEW') return ['WARN', 'REJECT'];
  return ['WARN', 'REJECT'];
}

function matchDecision(actual, expected) {
  const allowed = mapGoldenToEngine(expected);
  return allowed.includes(actual);
}

async function review(text) {
  const res = await fetch(`${BASE}/demo/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      country_id: 'SG',
      platform_id: 'META',
      category_id: 'electronics',
      content: { text },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function classifyResult(c, actual, findings) {
  if (c.modality !== 'text') {
    return { status: 'SKIP_MODALITY', note: `需${c.modality}能力，当前仅文本审核` };
  }
  const ok = matchDecision(actual, c.expected);
  if (ok) return { status: 'PASS', note: '' };
  if (actual === 'PASS' && c.expected === 'REJECT') {
    return { status: 'MISS', note: '应拦截但未命中（GAP）' };
  }
  if (actual === 'PASS' && c.expected === 'REVIEW') {
    return { status: 'MISS', note: '应提示人工复核但未命中（GAP）' };
  }
  if (actual === 'REJECT' && c.expected === 'REVIEW') {
    return { status: 'OVER', note: '过度拦截（偏严）' };
  }
  if (actual === 'WARN' && c.expected === 'REJECT') {
    return { status: 'UNDER', note: '应拒绝但仅 WARN（偏松）' };
  }
  return { status: 'MISMATCH', note: `expected ${c.expected}, got ${actual}` };
}

async function main() {
  const results = [];
  let pass = 0;
  let miss = 0;
  let over = 0;
  let under = 0;
  let skip = 0;
  let err = 0;

  for (const c of CASES) {
    if (c.modality !== 'text') {
      skip++;
      results.push({ ...c, actual: null, findings: [], ...classifyResult(c, null, []) });
      continue;
    }
    try {
      const body = await review(c.text);
      const actual = body.final_decision;
      const findings = (body.summary?.findings ?? []).map((f) => f.ref_id ?? f.rule_id ?? f.title).filter(Boolean);
      const verdict = classifyResult(c, actual, findings);
      results.push({ ...c, actual, findings, ...verdict });
      if (verdict.status === 'PASS') pass++;
      else if (verdict.status === 'MISS') miss++;
      else if (verdict.status === 'OVER') over++;
      else if (verdict.status === 'UNDER') under++;
    } catch (e) {
      err++;
      results.push({ ...c, actual: 'ERROR', error: String(e.message ?? e), status: 'ERROR' });
    }
  }

  const textTotal = CASES.filter((c) => c.modality === 'text').length;
  const summary = {
    benchmark: 'AAIRP Golden Benchmark Dataset v1.0',
    base_url: BASE,
    total: CASES.length,
    text_runnable: textTotal,
    skipped_multimodal: skip,
    pass,
    miss,
    over,
    under,
    error: err,
    text_pass_rate: textTotal ? `${((pass / textTotal) * 100).toFixed(1)}%` : 'n/a',
    critical_reject_cases: results.filter((r) => r.risk === 'Critical' && r.modality === 'text'),
  };

  writeFileSync(outPath, JSON.stringify({ summary, results }, null, 2), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
