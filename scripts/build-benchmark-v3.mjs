#!/usr/bin/env node
/**
 * Generate benchmark/benchmark-v3.json from benchmark-v2 + skill-modules + rewrite templates.
 * v2/golden remain upstream; v3 adds quality specification fields.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const v2Path = join(root, 'benchmark/benchmark-v2.json');
const modulesPath = join(root, 'docs/knowledge/skill-modules.json');
const templatesPath = join(root, 'docs/knowledge/rewrite-templates.json');
const overridesPath = join(root, 'benchmark/benchmark-v3.overrides.json');
const promotionPath = join(root, 'benchmark/benchmark-promotion-queue.json');
const userLinesPath = join(root, 'benchmark/user-lines-14.json');
const localeExpansionPath = join(root, 'benchmark/locale-expansion.json');
const outputPath = join(root, 'benchmark/benchmark-v3.json');

function deriveExpectedAction(expectedDecision, module) {
  if (expectedDecision === 'PASS') return 'PASS';
  if (expectedDecision === 'REJECT') return 'REJECT';
  if (expectedDecision === 'REVIEW') {
    return module?.escalation_policy?.unverified_high_severity === 'REVIEW' ? 'ESCALATE' : 'REVIEW';
  }
  return 'REWRITE';
}

function findPattern(modules, patternId) {
  if (!patternId) return undefined;
  for (const mod of modules.modules) {
    const p = mod.patterns.find((x) => x.pattern_id === patternId);
    if (p) return { module: mod, pattern: p };
  }
  return undefined;
}

function buildExpectedRewrite(pattern, templates) {
  if (!pattern?.rewrite_template_id) {
    return {
      strategy: 'qualify',
      must_remove_terms: [],
      must_include_concepts: [],
    };
  }
  const template = templates.templates.find((t) => t.template_id === pattern.rewrite_template_id);
  return {
    strategy: template?.strategy ?? 'qualify',
    template_id: pattern.rewrite_template_id,
    must_remove_terms: template?.must_remove_terms ?? [],
    must_include_concepts: template?.must_include_concepts ?? [],
  };
}

if (!existsSync(v2Path)) {
  execSync('node scripts/build-benchmark-v2.mjs', { cwd: root, stdio: 'inherit' });
}

const v2 = JSON.parse(readFileSync(v2Path, 'utf8'));
const modules = JSON.parse(readFileSync(modulesPath, 'utf8'));
const templates = JSON.parse(readFileSync(templatesPath, 'utf8'));
const overridesFile = JSON.parse(readFileSync(overridesPath, 'utf8'));
const promotion = JSON.parse(readFileSync(promotionPath, 'utf8'));
const userLines = existsSync(userLinesPath)
  ? JSON.parse(readFileSync(userLinesPath, 'utf8'))
  : { cases: [] };
const localeExpansion = existsSync(localeExpansionPath)
  ? JSON.parse(readFileSync(localeExpansionPath, 'utf8'))
  : { cases: [] };
const overrides = overridesFile.overrides ?? {};
const regressionIds = new Set(overridesFile.regression_case_ids ?? []);

const generatedAt = new Date().toISOString();

const casesFromV2 = v2.cases.map((c) => {
  const override = overrides[c.case_id] ?? {};
  const found = findPattern(modules, c.pattern_id);
  const skillModule = override.expected_skill ?? c.skill_module;
  const moduleContract = modules.modules.find((m) => m.skill_module === skillModule);

  const expectedDecision = override.expected_decision ?? c.expected_decision;
  const tier =
    override.tier ??
    (regressionIds.has(c.case_id) ? 'regression' : c.exclude_from_strict_linkage ? 'extended' : 'extended');

  return {
    case_id: c.case_id,
    expected_skill: skillModule,
    expected_pattern: override.expected_pattern ?? c.pattern_id,
    expected_rule: override.expected_rule ?? c.expected_rule,
    expected_decision: expectedDecision,
    expected_severity: override.expected_severity ?? c.expected_severity,
    expected_action:
      override.expected_action ?? deriveExpectedAction(expectedDecision, moduleContract),
    expected_rewrite: override.expected_rewrite ?? buildExpectedRewrite(found?.pattern, templates),
    evaluation_weight: override.evaluation_weight ?? (tier === 'regression' ? 1.0 : 0.5),
    tier,
    lifecycle_status: override.lifecycle_status ?? 'MAINTAINED',
    verified_by_legal: override.verified_by_legal ?? c.verified_by_legal ?? false,
    exclude_from_strict_linkage: c.exclude_from_strict_linkage ?? false,
    text: c.text,
    risk: c.risk,
    issue: c.issue,
    modality: c.modality,
    country_id: c.country_id,
    category_id: c.category_id,
    ...(c.fixture ? { fixture: c.fixture } : {}),
    provenance: {
      ...c.provenance,
      v3_generated_at: generatedAt,
      upstream: 'benchmark-v2',
    },
    ...(c.mapping_note ? { mapping_note: c.mapping_note } : {}),
  };
});

const casesFromPromotion = (promotion.candidates ?? [])
  .filter((candidate) => !casesFromV2.some((c) => c.case_id === candidate.candidate_id))
  .map((candidate) => ({
    case_id: candidate.candidate_id,
    expected_skill: candidate.skill_module,
    expected_pattern: candidate.pattern_id,
    expected_rule: candidate.expected_rule ?? null,
    expected_decision: candidate.expected_decision ?? 'REVIEW',
    expected_severity: candidate.expected_severity ?? 'MEDIUM',
    expected_action: candidate.expected_action ?? 'ESCALATE',
    expected_rewrite: candidate.expected_rewrite ?? { strategy: 'qualify' },
    evaluation_weight: candidate.evaluation_weight ?? 0.5,
    tier: candidate.proposed_tier ?? 'candidate',
    lifecycle_status: candidate.lifecycle_status ?? 'BENCHMARK_CANDIDATE',
    verified_by_legal: candidate.verified_by_legal ?? false,
    exclude_from_strict_linkage: true,
    text: candidate.text ?? candidate.candidate_id,
    issue: candidate.issue ?? 'promoted',
    modality: candidate.modality ?? 'text',
    provenance: {
      source: 'promotion-queue',
      source_case_id: candidate.source_case_id,
      v3_generated_at: generatedAt,
    },
  }));

function deriveUserLineAction(expectedDecision) {
  if (expectedDecision === 'PASS') return 'PASS';
  if (expectedDecision === 'REJECT') return 'REJECT';
  return 'REWRITE';
}

const casesFromUserLines = (userLines.cases ?? [])
  .filter((c) => !casesFromV2.some((v2) => v2.case_id === c.case_id))
  .map((c) => ({
    case_id: c.case_id,
    expected_skill: c.expected_skill ?? 'Claim Review',
    expected_pattern: c.expected_pattern ?? null,
    expected_rule: c.expected_rule ?? null,
    expected_decision: c.expected_decision,
    expected_severity: c.expected_severity ?? 'MEDIUM',
    expected_action: c.expected_action ?? deriveUserLineAction(c.expected_decision),
    expected_rewrite: c.expected_rewrite ?? { strategy: 'qualify', must_remove_terms: [], must_include_concepts: [] },
    evaluation_weight: regressionIds.has(c.case_id) ? 1.0 : 0.5,
    tier: regressionIds.has(c.case_id) ? 'regression' : 'extended',
    lifecycle_status: 'HUMAN_VERIFIED',
    verified_by_legal: true,
    exclude_from_strict_linkage: false,
    text: c.text,
    risk: c.risk ?? 'Medium',
    issue: c.issue ?? 'user-lines-14',
    modality: 'text',
    country_id: c.country_id ?? 'SG',
    category_id: c.category_id ?? 'electronics',
    provenance: {
      source: 'user-lines-14',
      upstream: 'benchmark/user-lines-14.json',
      v3_generated_at: generatedAt,
    },
  }));

const casesFromLocaleExpansion = (localeExpansion.cases ?? [])
  .filter(
    (c) =>
      !casesFromV2.some((v2) => v2.case_id === c.case_id) &&
      !casesFromUserLines.some((ul) => ul.case_id === c.case_id),
  )
  .map((c) => {
    const moduleContract = modules.modules.find((m) => m.skill_module === c.expected_skill);
    return {
      case_id: c.case_id,
      expected_skill: c.expected_skill,
      expected_pattern: c.expected_pattern ?? null,
      expected_rule: c.expected_rule ?? null,
      expected_decision: c.expected_decision,
      expected_severity: c.expected_severity ?? 'MEDIUM',
      expected_action:
        c.expected_action ?? deriveExpectedAction(c.expected_decision, moduleContract),
      expected_rewrite: c.expected_rewrite ?? {
        strategy: 'qualify',
        must_remove_terms: [],
        must_include_concepts: [],
      },
      evaluation_weight: c.evaluation_weight ?? 0.75,
      tier: 'locale-expansion',
      lifecycle_status: c.lifecycle_status ?? 'MAINTAINED',
      verified_by_legal: c.verified_by_legal ?? true,
      exclude_from_strict_linkage: false,
      text: c.text,
      risk: c.risk ?? 'Medium',
      issue: c.issue ?? 'locale-expansion',
      modality: c.modality ?? 'text',
      country_id: c.country_id,
      category_id: c.category_id,
      provenance: {
        source: 'locale-expansion',
        upstream: 'benchmark/locale-expansion.json',
        dataset_case_id: c.case_id,
        v3_generated_at: generatedAt,
      },
    };
  });

const cases = [
  ...casesFromV2,
  ...casesFromPromotion,
  ...casesFromUserLines,
  ...casesFromLocaleExpansion,
];

const contentBody = {
  schema_version: '3.0.0',
  benchmark_id: 'aairp-benchmark-v3',
  modules_version: modules.modules_version,
  description: 'Quality specification benchmark — generated from v2 + skill-modules + rewrite templates',
  generated_at: generatedAt,
  evaluation_profile: {
    dimensions: ['decision', 'pattern_hit', 'severity', 'action', 'rewrite'],
    default_weights: {
      decision: 0.35,
      pattern_hit: 0.2,
      severity: 0.1,
      action: 0.15,
      rewrite: 0.2,
    },
  },
  source: {
    v2_path: 'benchmark/benchmark-v2.json',
    modules_path: 'docs/knowledge/skill-modules.json',
    templates_path: 'docs/knowledge/rewrite-templates.json',
    overrides_path: 'benchmark/benchmark-v3.overrides.json',
    promotion_path: 'benchmark/benchmark-promotion-queue.json',
    user_lines_path: 'benchmark/user-lines-14.json',
    locale_expansion_path: 'benchmark/locale-expansion.json',
  },
  case_count: cases.length,
  cases,
};

const content = `${JSON.stringify(contentBody, null, 2)}\n`;
const fingerprint = createHash('sha256').update(content).digest('hex');

writeFileSync(outputPath, `${JSON.stringify({ ...contentBody, content_fingerprint: fingerprint }, null, 2)}\n`);
console.log(`Generated ${outputPath} (${cases.length} cases, fingerprint ${fingerprint.slice(0, 12)}…)`);
