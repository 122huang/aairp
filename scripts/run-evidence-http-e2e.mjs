/**
 * HTTP evidence Step1–4 E2E against a running API (needs Postgres/Redis + API on PORT).
 * Usage: node scripts/run-evidence-http-e2e.mjs
 * Env:
 *   API_BASE_URL (default http://127.0.0.1:3000)
 *   AAIRP_REVIEW_BASIC_AUTH_USER / AAIRP_REVIEW_BASIC_AUTH_PASSWORD (when API auth is enabled)
 *   AAIRP_EVIDENCE_JUDGMENT_MODE=stub only for local/CI fixture checks.
 *   Production must use AAIRP_EVIDENCE_JUDGMENT_MODE=live (or inherit live open-risk).
 *   Stub ignores document bytes and always returns demo/evidence-judgment.stub.json —
 *   it does NOT special-case PLACEHOLDER-* titles.
 *
 * Uses non-sensitive placeholder evidence only — do not point at production with real CLM docs.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = (process.env.API_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const AD_TEXT =
  'PC201/PC200 - Cook for up to 8-10 people. 6.5 qt nonstick cooking pot fits up to a 4lb. chicken or a 5lb. roast for creating meals for large groups.';

/** Synthetic capacity memo — not a real internal CLM document. */
const CAPACITY_MEMO = `PLACEHOLDER-CAP-001 — Synthetic Capacity Test Memo (PC201/PC200)
Product models: PC201 / PC200 combination multi-cooker
Test method: Standard full-pot stew fill test. Total cooked food weight measured after draining on calibrated scale.
Measured total weight range: 1.96 kg – 2.45 kg (1960g – 2450g)
Reference standard: FDA single-serving reference weight 245g per person (conservative)
Calculation: 2450g ÷ 245g/person = 10 servings; conservative lower bound 8 servings at 1960g ÷ 245g = 8
Conclusion: Claim "Cook for up to 8-10 people" is supported by measured yield and documented methodology.`;

/** Synthetic unrelated lab note — not a real SGS report. */
const UNRELATED_LAB = `PLACEHOLDER-LAB-001 — Synthetic Lab Note
Product under test: Rice Cooker Model 40N1S
Test subject: Non-stick coating adhesion performance
Result: Pass
Note: This report covers 40N1S rice cooker non-stick performance only — not PC201/PC200 capacity claims.`;

function b64(s) {
  return Buffer.from(s, 'utf8').toString('base64');
}

function authHeaders() {
  const user = process.env.AAIRP_REVIEW_BASIC_AUTH_USER?.trim() ?? '';
  const password = process.env.AAIRP_REVIEW_BASIC_AUTH_PASSWORD ?? '';
  if (!user || !password) return {};
  return {
    authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
  };
}

function requireAuthForRemote() {
  const remote =
    !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(base) &&
    !base.includes('127.0.0.1') &&
    !base.includes('localhost');
  if (!remote) return;
  const user = process.env.AAIRP_REVIEW_BASIC_AUTH_USER?.trim() ?? '';
  const password = process.env.AAIRP_REVIEW_BASIC_AUTH_PASSWORD ?? '';
  if (!user || !password) {
    throw new Error(
      'Remote API_BASE_URL requires AAIRP_REVIEW_BASIC_AUTH_USER and AAIRP_REVIEW_BASIC_AUTH_PASSWORD (same values as Railway).',
    );
  }
}

async function json(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-aairp-probe': '1',
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 500)}`);
  }
  return data;
}

async function main() {
  requireAuthForRemote();

  const health = await fetch(`${base}/health`).catch((e) => {
    throw new Error(`API not reachable at ${base}: ${e.message}`);
  });
  if (!health.ok) throw new Error(`health ${health.status}`);

  const review = await json('POST', '/demo/review', {
    country_id: 'SG',
    platform_id: 'demo-review',
    category_id: 'sa.rice_cooker',
    content: { text: AD_TEXT },
    context: { product_sku: 'PC201' },
  });

  const findings = review.summary?.findings ?? review.findings ?? [];
  const capacity = findings.find((f) => f.ref_id === 'demo-apac-sa-capacity-claim');
  if (!capacity) {
    throw new Error(
      `Step1 fail: no capacity finding. refs=${findings.map((f) => f.ref_id).join(',')}`,
    );
  }
  if (capacity.remediation_type !== 'EVIDENCE_SUPPLEMENT') {
    throw new Error(`Step1 fail: remediation_type=${capacity.remediation_type}`);
  }

  const claimAnchor = capacity.evidence_spans?.[0]?.text ?? 'up to 8-10 people';
  const judgment_context = {
    country_id: 'SG',
    category_id: 'sa.rice_cooker',
    product_sku: 'PC201',
    ad_text: AD_TEXT,
    finding_summary: capacity.summary,
    remediation_type: capacity.remediation_type,
    risk_type: 'capacity-claim',
    claim_anchor_text: claimAnchor,
    matched_spans: capacity.evidence_spans,
  };

  const clm = await json('POST', '/demo/finding-evidence', {
    review_id: review.review_id,
    finding_id: capacity.finding_id,
    title: 'PLACEHOLDER-CAP-001 Synthetic capacity memo (PC201/PC200)',
    evidence_source_type: 'INTERNAL_TEST',
    scope: { countries: ['SG'], categories: ['sa.rice_cooker'], skus: ['PC201', 'PC200'] },
    claim_risk_types: ['capacity-claim'],
    file: {
      filename: 'placeholder-capacity-memo.txt',
      mime_type: 'text/plain',
      content_base64: b64(CAPACITY_MEMO),
    },
    judgment_context,
  });

  const sgs = await json('POST', '/demo/finding-evidence', {
    review_id: review.review_id,
    finding_id: capacity.finding_id,
    title: 'PLACEHOLDER-LAB-001 Unrelated non-stick note (40N1S)',
    evidence_source_type: 'THIRD_PARTY_LAB',
    scope: { skus: ['40N1S'] },
    claim_risk_types: ['capacity-claim'],
    file: {
      filename: 'placeholder-unrelated-lab.txt',
      mime_type: 'text/plain',
      content_base64: b64(UNRELATED_LAB),
    },
    judgment_context,
  });

  const list = await json(
    'GET',
    `/demo/reviews/${review.review_id}/findings/${capacity.finding_id}/evidence`,
  );

  const report = {
    run_at: new Date().toISOString(),
    mode: 'http-e2e',
    api_base: base,
    review_id: review.review_id,
    capacity_finding_id: capacity.finding_id,
    checks: {
      step1_capacity_evidence_supplement:
        capacity.ref_id === 'demo-apac-sa-capacity-claim' &&
        capacity.remediation_type === 'EVIDENCE_SUPPLEMENT',
      step2_clm_strong_sufficient:
        clm.ai_judgment?.relevance === 'strong' &&
        clm.ai_judgment?.sufficiency === 'sufficient' &&
        !clm.ai_judgment?.prescreen_excluded,
      step3_prescreen_pc201_pc200_not_blocked: !clm.ai_judgment?.prescreen_excluded,
      step4_sgs_prescreen_no_llm:
        sgs.ai_judgment?.relevance === 'none' && sgs.ai_judgment?.prescreen_excluded === true,
      list_returns_links: Array.isArray(list.links) && list.links.length >= 2,
    },
    clm: clm.ai_judgment,
    sgs: sgs.ai_judgment,
  };

  report.all_pass = Object.values(report.checks).every(Boolean);
  mkdirSync(join(root, 'reports'), { recursive: true });
  const out = join(root, 'reports', 'evidence-http-e2e-run.json');
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log('Report:', out);
  process.exit(report.all_pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
