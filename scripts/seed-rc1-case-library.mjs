#!/usr/bin/env node
/**
 * RC1-Demo: seed 5 case-library JSON records (no DB).
 * Run: node scripts/seed-rc1-case-library.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = JSON.parse(
  fs.readFileSync(path.join(root, 'case-library/examples/sg-health-reject-cure.case.json'), 'utf8'),
);
const outDir = path.join(root, 'case-library/cases/2026/06');

const seeds = [
  {
    id: 'case_rc1_reject_cure',
    rev: 'rev_rc1_001',
    hash: 'sha256:rc1_reject',
    text: 'Clinically proven to cure diabetes in 7 days. Buy now!',
    dec: 'REJECT',
    cat: 'health.supplement',
    rules: base.matched_rules,
    pbs: [],
    skip: true,
    regs: base.reference_regulations,
    rat: 'Rule BLOCKER: demo-sg-health-forbidden-claim (BLOCKER)',
    fc: { rule: 1, playbook: 0, llm: 0 },
  },
  {
    id: 'case_rc1_pass_food',
    rev: 'rev_rc1_002',
    hash: 'sha256:rc1_food',
    text: 'Organic snacks for everyday enjoyment. No artificial colours. #ad',
    dec: 'PASS',
    cat: 'food',
    rules: [],
    pbs: [],
    skip: false,
    regs: [],
    rat: 'No blocking or warning findings across Rule, Playbook, Case, or Open Risk modules.',
    fc: { rule: 0, playbook: 0, llm: 0 },
  },
  {
    id: 'case_rc1_warn_disclosure',
    rev: 'rev_rc1_003',
    hash: 'sha256:rc1_disclosure',
    text: 'Daily vitamins for general wellness. Supports your active lifestyle.',
    dec: 'WARN',
    cat: 'health.supplement',
    rules: [
      {
        finding_id: 'rf_rc1_003',
        ref_id: 'demo-sg-sponsored-disclosure',
        ref_version_id: 'demo-sg-sponsored-disclosure-v1',
        severity: 'LOW',
        decision: 'WARN',
        summary: 'Sponsored content should include an ad disclosure',
        confidence: 0.9,
      },
    ],
    pbs: [],
    skip: false,
    regs: [],
    rat: 'Warning issued based on: RULE/demo-sg-sponsored-disclosure (LOW).',
    fc: { rule: 1, playbook: 0, llm: 0 },
  },
  {
    id: 'case_rc1_warn_superlative',
    rev: 'rev_rc1_004',
    hash: 'sha256:rc1_superlative',
    text: 'Clinically proven daily vitamins. Guaranteed results. Shop now. #ad',
    dec: 'WARN',
    cat: 'health.supplement',
    rules: [
      {
        finding_id: 'rf_rc1_004',
        ref_id: 'demo-sg-health-superlative',
        ref_version_id: 'demo-sg-health-superlative-v1',
        severity: 'MEDIUM',
        decision: 'WARN',
        summary: 'Unsubstantiated superlative or efficacy claims require substantiation',
        confidence: 0.85,
      },
    ],
    pbs: [
      {
        finding_id: 'pf_rc1_004',
        ref_id: 'unsubstantiated-testimonial',
        ref_version_id: 'demo-playbook-v1',
        severity: 'MEDIUM',
        decision: 'WARN',
        summary: 'Efficacy or testimonial claim detected',
        confidence: 0.8,
      },
    ],
    skip: false,
    regs: [],
    rat: 'Warning issued based on Rule and Playbook findings.',
    fc: { rule: 1, playbook: 1, llm: 0 },
  },
  {
    id: 'case_rc1_pass_wellness',
    rev: 'rev_rc1_005',
    hash: 'sha256:rc1_wellness',
    text: 'Daily vitamins for general wellness. Not intended to diagnose or treat disease. #ad',
    dec: 'PASS',
    cat: 'health.supplement',
    rules: [],
    pbs: [],
    skip: false,
    regs: [],
    rat: 'No blocking or warning findings across Rule, Playbook, Case, or Open Risk modules.',
    fc: { rule: 0, playbook: 0, llm: 0 },
  },
];

fs.mkdirSync(outDir, { recursive: true });

const entries = seeds.map((s) => {
  const r = structuredClone(base);
  r.case_id = s.id;
  r.review_id = s.rev;
  r.advertisement_id = `ad_${s.id}`;
  r.dimensions.category_id = s.cat;
  r.advertisement.advertisement_id = `ad_${s.id}`;
  r.advertisement.content_hash = s.hash;
  r.advertisement.content.text = s.text;
  r.context_builder_output.review_id = s.rev;
  r.context_builder_output.content_hash = s.hash;
  r.context_builder_output.normalized_content.text = s.text;
  r.matched_rules = s.rules;
  r.matched_playbooks = s.pbs;
  r.llm_analysis = {
    prompt_pack_version: 'demo-open-risk-1.1.0',
    skipped: s.skip,
    ...(s.skip ? { skip_reason: 'HAS_BLOCKER' } : {}),
    findings: [],
    evaluated_at: '2026-06-26T11:00:00.000Z',
  };
  r.decision = {
    ai_decision: s.dec,
    confidence: s.dec === 'REJECT' ? 1 : 0.95,
    rationale: s.rat,
    finding_counts: s.fc,
    decided_at: '2026-06-26T11:00:00.000Z',
    final_decision: s.dec,
  };
  r.reference_regulations = s.regs;
  r.evidence = s.id === 'case_rc1_reject_cure' ? base.evidence : [];
  r.metadata.review_id = s.rev;
  r.metadata.open_risk_skipped = s.skip;
  r.created_at = '2026-06-26T11:00:00.000Z';
  r.updated_at = '2026-06-26T11:00:00.000Z';

  const rel = path.posix.join('cases/2026/06', `${s.id}.json`);
  fs.writeFileSync(path.join(root, 'case-library', rel), `${JSON.stringify(r, null, 2)}\n`);

  return {
    case_id: s.id,
    case_version: 1,
    path: rel,
    review_id: s.rev,
    country_id: 'SG',
    category_id: s.cat,
    platform_id: 'META',
    language: 'en',
    ai_decision: s.dec,
    final_decision: s.dec,
    lifecycle_status: 'GENERATED',
    content_hash: s.hash,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
});

const manifest = {
  schema_version: '1.0.0',
  updated_at: new Date().toISOString(),
  entries,
};

fs.mkdirSync(path.join(root, 'case-library/index'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'case-library/index/manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`RC1 case library seeded: ${entries.length} cases`);
