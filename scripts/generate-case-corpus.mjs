import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const benchmarkPath = join(repoRoot, 'benchmark/benchmark-v3.json');
const outDir = join(repoRoot, 'docs/knowledge/case-corpus/cases');
mkdirSync(outDir, { recursive: true });

const PILOT_CASE_IDS = [
  'sg-health-reject-cure',
  'PC-008',
  'sg-health-warn-superlative',
  'sg-health-warn-disclosure',
  'supplement-before-after-imagery',
  'sg-health-pass-disclosed',
  'AF-004',
  'PC-007',
  'PC-006',
  'AF-002',
  'GEN-007',
  'AF-003',
  'AF-006',
  'PC-012',
  'RC18-003',
  'AF-009',
  'AF-010',
  'RC18-004',
  'AF-001',
  'AF-007',
  'PC-001',
  'RC18-005',
  'PC-014',
  'sg-health-playbook-urgency',
  'supplement-ad-manifest-urgency',
  'PC-013',
  'RC18-002',
  'AF-008',
];

const PATTERN_SKILL = {
  'sa-certification-evidence': 'skill:certification-claim-review',
  'sa-performance-claim': 'skill:performance-claim-review',
  'sa-capacity-claim': 'skill:performance-claim-review',
  'sa-absolute-performance': 'skill:superlative-claim-review',
  'unsubstantiated-testimonial': 'skill:superlative-claim-review',
  'sa-comparative-claim': 'skill:comparative-claim-review',
  'sa-comparative-superiority': 'skill:comparative-claim-review',
  'sa-health-implication': 'skill:health-claim-review',
};

const TEMPLATE_REWRITE = {
  'cite-evidence': 'rewrite:cite-evidence',
  'qualify-performance': 'rewrite:qualify-performance',
  'qualify-comparative': 'rewrite:qualify-comparative',
  'qualify-efficacy': 'rewrite:qualify-efficacy',
  'remove-health-claim': 'rewrite:remove-health-claim',
  'disclose-localization': 'rewrite:disclose-localization',
  'disclose-ai': 'rewrite:disclose-ai',
  'disclose-urgency': 'rewrite:disclose-urgency',
  'disclose-transformation': 'rewrite:disclose-transformation',
};

const CLUSTER_BY_ISSUE = {
  Health: 'health-claim',
  'Health Claim': 'health-claim',
  'Performance Claim': 'performance-claim',
  'Capacity Claim': 'performance-claim',
  'Absolute Claim': 'performance-claim',
  'Comparative Claim': 'comparative-claim',
  'Comparative Advertising': 'comparative-claim',
  Certification: 'certification-claim',
  Evidence: 'certification-claim',
  Patent: 'certification-claim',
  Localization: 'disclosure-claim',
  Disclaimer: 'disclosure-claim',
  'AI Image Quality': 'disclosure-claim',
};

const SKILL_REGULATIONS = {
  'skill:certification-claim-review': [
    'regulation:sg-hsa-certification-marks',
    'regulation:my-sirim-certification-marks',
  ],
  'skill:performance-claim-review': [
    'regulation:sg-hsa-efficacy-performance',
    'regulation:th-tisi-performance-claims',
  ],
  'skill:health-claim-review': [
    'regulation:sg-hsa-supplement-health-claims',
    'regulation:sg-hpa-s7-prohibited-claims',
  ],
  'skill:comparative-claim-review': [
    'regulation:sg-asas-comparative-claims',
    'regulation:my-masa-comparative-advertising',
  ],
  'skill:superlative-claim-review': [
    'regulation:sg-asasa-substantiation',
    'regulation:sg-asas-comparative-claims',
  ],
};

const EVIDENCE_BY_SKILL = {
  'skill:certification-claim-review': 'evidence:certification-mark-substantiation',
  'skill:performance-claim-review': 'evidence:performance-lab-report',
  'skill:health-claim-review': 'evidence:health-claim-substantiation',
  'skill:comparative-claim-review': 'evidence:comparative-claim-substantiation',
  'skill:superlative-claim-review': 'evidence:efficacy-superlative-substantiation',
};

const EVIDENCE_REQUIRED_SKILLS = new Set([
  'skill:certification-claim-review',
  'skill:performance-claim-review',
  'skill:health-claim-review',
  'skill:comparative-claim-review',
  'skill:superlative-claim-review',
]);

const EVIDENCE_REQUIRED_REWRITES = new Set(['rewrite:cite-evidence']);

function slugifyCaseId(caseId) {
  return caseId.toLowerCase().replace(/_/g, '-');
}

function claimTypeForCluster(cluster) {
  if (cluster === 'health-claim') return ['health-claim'];
  if (cluster === 'performance-claim') return ['performance-claim'];
  if (cluster === 'comparative-claim') return ['comparative-claim'];
  if (cluster === 'certification-claim') return ['certification-claim'];
  return ['disclosure-claim'];
}

function inferSkill(benchmarkCase) {
  if (benchmarkCase.expected_pattern && PATTERN_SKILL[benchmarkCase.expected_pattern]) {
    return PATTERN_SKILL[benchmarkCase.expected_pattern];
  }
  if (benchmarkCase.expected_skill === 'Evidence Review') {
    return 'skill:certification-claim-review';
  }
  return null;
}

function inferRewrite(benchmarkCase) {
  const templateId = benchmarkCase.expected_rewrite?.template_id;
  if (templateId && TEMPLATE_REWRITE[templateId]) {
    return TEMPLATE_REWRITE[templateId];
  }
  const strategy = benchmarkCase.expected_rewrite?.strategy;
  if (strategy === 'disclose') return 'rewrite:disclose-ai';
  return null;
}

function needsEvidenceValidation(skillId, rewriteId) {
  if (skillId && EVIDENCE_REQUIRED_SKILLS.has(skillId)) return true;
  if (rewriteId && EVIDENCE_REQUIRED_REWRITES.has(rewriteId)) return true;
  return false;
}

const benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8'));
const byId = new Map(benchmark.cases.map((item) => [item.case_id, item]));

for (const caseId of PILOT_CASE_IDS) {
  const bm = byId.get(caseId);
  if (!bm) {
    throw new Error(`Missing benchmark case: ${caseId}`);
  }

  const slug = slugifyCaseId(caseId);
  const cluster = CLUSTER_BY_ISSUE[bm.issue] ?? 'disclosure-claim';
  const skillId = inferSkill(bm);
  const rewriteId = inferRewrite(bm);
  const regulations = skillId ? (SKILL_REGULATIONS[skillId] ?? []) : ['regulation:sg-scap-disclosure'];
  const rules = bm.expected_rule ? [bm.expected_rule] : [];

  const linkage = {
    regulations,
    rules,
    skills: skillId ? [skillId] : [],
    rewrites: rewriteId ? [rewriteId] : [],
    evidence: [],
  };

  const evidenceValidation = {};
  if (needsEvidenceValidation(skillId, rewriteId)) {
    const evidenceId = skillId ? EVIDENCE_BY_SKILL[skillId] : 'evidence:certification-mark-substantiation';
    linkage.evidence = evidenceId ? [evidenceId] : [];
    evidenceValidation.evidence_id = evidenceId;
    evidenceValidation.expected_outcome =
      bm.expected_decision === 'REJECT' ? 'reject_insufficient_substantiation' : 'require_substantiation_on_file';
  }

  const caseResult = {
    decision_outcome: bm.expected_decision,
    risk_level: bm.expected_severity ?? bm.risk ?? 'MEDIUM',
    matched_skill: skillId,
    applied_rewrite: rewriteId,
    evidence_result: evidenceValidation.expected_outcome ?? 'not_applicable',
  };

  const entry = {
    knowledge_id: `case:${slug}`,
    corpus_type: 'case',
    case_id: slug,
    case_purpose: `Validation knowledge for benchmark case ${caseId} — ${bm.issue ?? 'review scenario'}.`,
    case_status: 'verified',
    case_version: '1.0.0',
    verification_status: bm.verified_by_legal ? 'legal_verified' : 'human_verified',
    summary: `Validates ${bm.issue ?? 'advertising review'} scenario; expected ${bm.expected_decision} with ${bm.expected_action ?? 'review'} action.`,
    review_guidance: `TRIGGER: Benchmark case ${caseId}. ACTION: Compare eval output to case_result. CHECK: decision, skill, rewrite, evidence expectations. ESCALATE IF: regression against verified ground truth.`,
    scenario_spec: {
      claim_cluster: cluster,
      claim_types: claimTypeForCluster(cluster),
      countries: [bm.country_id ?? 'SG'],
      categories: [bm.category_id ?? 'electronics'],
      modalities: [bm.modality ?? 'text'],
      risk_class: bm.expected_severity ?? bm.risk ?? 'MEDIUM',
      signal_summary: bm.issue ?? bm.text?.slice(0, 80) ?? caseId,
      benchmark_ref: caseId,
    },
    ground_truth_spec: {
      expected_decision: bm.expected_decision,
      expected_severity: bm.expected_severity,
      expected_action: bm.expected_action,
      expected_pattern: bm.expected_pattern ?? undefined,
      expected_rule: bm.expected_rule ?? undefined,
      expected_rewrite: bm.expected_rewrite?.template_id
        ? {
            rewrite_id: rewriteId,
            strategy_type: bm.expected_rewrite.strategy,
            must_remove_terms: bm.expected_rewrite.must_remove_terms ?? [],
            must_include_concepts: bm.expected_rewrite.must_include_concepts ?? [],
          }
        : undefined,
      evidence_validation: Object.keys(evidenceValidation).length > 0 ? evidenceValidation : undefined,
    },
    case_result: caseResult,
    benchmark_ref: caseId,
    linkage,
    promotion_rationale: `Pilot Case Corpus entry aligned to benchmark-v3 ${caseId} for ${cluster} validation.`,
    owner: 'knowledge-eng@aairp',
    owner_type: 'knowledge_eng',
    last_reviewed: '2026-07-01T00:00:00.000Z',
    review_status: 'legal_reviewed',
    confidence_level: bm.verified_by_legal ? 'high' : 'medium',
    tags: ['confidence:medium', 'validation', cluster],
  };

  writeFileSync(join(outDir, `${slug}.json`), `${JSON.stringify(entry, null, 2)}\n`);
}

console.log(`Wrote ${PILOT_CASE_IDS.length} case corpus entries`);
