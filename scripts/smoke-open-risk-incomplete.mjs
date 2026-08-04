/**
 * Live fail-soft smoke: force Open Risk gateway failure on a non-BLOCKER ad and
 * assert /demo/review returns 200 with open_risk_incomplete (not HTTP 500).
 *
 * Usage (from repo root, after packages are built):
 *   node scripts/smoke-open-risk-incomplete.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadEnvFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return false;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const loaded =
  loadEnvFile(resolve(repoRoot, '.env')) ||
  loadEnvFile(resolve(process.cwd(), '.env')) ||
  loadEnvFile(resolve(process.cwd(), '../../.env'));
if (!loaded) {
  console.error('Could not load .env (DATABASE_URL required for API bootstrap).');
  process.exit(1);
}

// Force live Open Risk, then break the provider so fail-soft incomplete is exercised.
process.env.AAIRP_OPEN_RISK_MODE = 'live';
process.env.OPEN_RISK_LLM_PROVIDER = 'deepseek';
process.env.DEEPSEEK_API_KEY = 'smoke-invalid-key-force-incomplete';
process.env.AAIRP_VISION_MODE = process.env.AAIRP_VISION_MODE || 'off';
process.env.AAIRP_REWRITE_MODE = process.env.AAIRP_REWRITE_MODE || 'off';
process.env.AAIRP_CASE_STORAGE = 'json';
// Keep startup happy even when Upstash is down.
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const { buildApp, loadApiConfig } = await import('../apps/api/src/app.ts');

const config = loadApiConfig();
const app = await buildApp(config);
await app.ready();

const payload = {
  country_id: 'SG',
  platform_id: 'META',
  category_id: 'sa.vacuum_floor',
  content: { text: 'Compact cordless vacuum for everyday floor cleaning.' },
};

const started = Date.now();
const response = await app.inject({
  method: 'POST',
  url: '/demo/review',
  headers: {
    accept: 'application/json',
    'content-type': 'application/json',
  },
  payload,
});
const elapsedMs = Date.now() - started;

await app.close();

const body = response.json();
const summary = body?.summary ?? {};
const ok =
  response.statusCode === 200 &&
  summary.open_risk_incomplete === true &&
  typeof summary.open_risk_incomplete_reason === 'string' &&
  summary.open_risk_incomplete_reason.length > 0 &&
  summary.open_risk_skipped !== true &&
  body.final_decision === 'REVIEW' &&
  typeof body.report_html === 'string' &&
  body.report_html.includes('incomplete');

const report = {
  ok,
  statusCode: response.statusCode,
  elapsedMs,
  final_decision: body.final_decision,
  open_risk_skipped: summary.open_risk_skipped,
  open_risk_skip_reason: summary.open_risk_skip_reason,
  open_risk_incomplete: summary.open_risk_incomplete,
  open_risk_incomplete_reason: summary.open_risk_incomplete_reason,
  llm_finding_count: summary.finding_counts?.llm ?? body.finding_counts?.llm,
  rationale: body.rationale,
  report_has_incomplete_note: typeof body.report_html === 'string' && body.report_html.includes('incomplete'),
};

console.log(JSON.stringify(report, null, 2));

if (!ok) {
  console.error('SMOKE FAILED: expected HTTP 200 + open_risk_incomplete + REVIEW (no 500).');
  if (response.statusCode >= 500) {
    console.error(JSON.stringify(body, null, 2).slice(0, 2000));
  }
  process.exit(1);
}

console.log('SMOKE PASSED: live Open Risk failure returned a report with incomplete marker.');
