#!/usr/bin/env node
/**
 * Generate benchmark/benchmark-v2.json from golden-benchmark-v1-cases.json + skill-taxonomy.json.
 * Golden dataset is the source of truth; supplemental ad-manifest / override cases fill pattern gaps.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const goldenPath = join(root, 'scripts/golden-benchmark-v1-cases.json');
const taxonomyPath = join(root, 'docs/knowledge/skill-modules.json');
const adManifestPath = join(root, 'benchmark/ad-manifest.json');
const overridesPath = join(root, 'benchmark/benchmark-v2.overrides.json');
const outputPath = join(root, 'benchmark/benchmark-v2.json');

function normalizeSeverity(risk, fallback) {
  if (!risk) return fallback ?? 'MEDIUM';
  const map = {
    Critical: 'HIGH',
    High: 'HIGH',
    Medium: 'MEDIUM',
    Low: 'LOW',
  };
  return map[risk] ?? fallback ?? 'MEDIUM';
}

function patternModule(taxonomy, patternId) {
  for (const mod of taxonomy.modules) {
    if (mod.patterns.some((p) => p.pattern_id === patternId)) {
      return mod.skill_module;
    }
  }
  return 'Claim Review';
}

function buildGoldenCase(golden, taxonomy, overrides, generatedAt) {
  const issueMap = taxonomy.golden_issue_map[golden.issue];
  const override = overrides[golden.id] ?? {};
  const mapping = issueMap ?? {
    skill_module: 'Content Quality Review',
    pattern_id: null,
    expected_rule: null,
  };

  return {
    case_id: golden.id,
    skill_module: override.skill_module ?? mapping.skill_module,
    pattern_id: override.pattern_id !== undefined ? override.pattern_id : mapping.pattern_id,
    expected_rule: override.expected_rule !== undefined ? override.expected_rule : mapping.expected_rule,
    expected_decision: override.expected_decision ?? golden.expected,
    expected_severity:
      override.expected_severity ??
      normalizeSeverity(golden.risk, mapping.default_expected_severity),
    verified_by_legal: override.verified_by_legal ?? false,
    exclude_from_strict_linkage:
      override.exclude_from_strict_linkage ??
      (golden.issue === 'Internal Note' ||
        mapping.expected_rule === null ||
        mapping.pattern_id === null),
    text: golden.text,
    risk: golden.risk,
    issue: golden.issue,
    modality: golden.modality,
    country_id: override.country_id ?? inferReviewDimensions(golden.id).country_id,
    category_id: override.category_id ?? inferReviewDimensions(golden.id).category_id,
    ...(golden.fixture ? { fixture: golden.fixture } : {}),
    provenance: {
      source: 'golden-v1',
      golden_id: golden.id,
      generated_at: generatedAt,
    },
    ...(mapping.mapping_note ? { mapping_note: mapping.mapping_note } : {}),
  };
}

function buildAdManifestSupplement(manifestCase, taxonomy, generatedAt) {
  const playbookFindings =
    manifestCase.ground_truth?.expected_findings?.filter((f) => f.module === 'PLAYBOOK') ?? [];
  const ruleFinding = manifestCase.ground_truth?.expected_findings?.find((f) => f.module === 'RULE');
  const isBlockerReject =
    manifestCase.ground_truth?.expected_decision === 'REJECT' && Boolean(ruleFinding);
  const patternId = isBlockerReject
    ? (playbookFindings.find((f) => f.ref_id === 'unsubstantiated-testimonial')?.ref_id ??
      playbookFindings[0]?.ref_id ??
      null)
    : (playbookFindings[0]?.ref_id ?? null);
  const skillModule =
    ruleFinding?.ref_id === 'demo-sg-health-forbidden-claim'
      ? 'Claim Review'
      : patternId
        ? patternModule(taxonomy, patternId)
        : 'Claim Review';
  const dimensions = manifestCase.context?.dimensions;
  return {
    case_id: manifestCase.case_id,
    skill_module: skillModule,
    pattern_id: patternId,
    expected_rule: ruleFinding?.ref_id ?? null,
    expected_decision: manifestCase.ground_truth.expected_decision,
    expected_severity: isBlockerReject ? 'BLOCKER' : 'MEDIUM',
    verified_by_legal: true,
    exclude_from_strict_linkage: !patternId || !ruleFinding?.ref_id,
    text: manifestCase.context?.normalizedContent?.text ?? manifestCase.description,
    issue: manifestCase.description,
    modality: 'text',
    country_id: dimensions?.countryId ?? 'SG',
    category_id: dimensions?.categoryId ?? inferReviewDimensions(manifestCase.case_id).category_id,
    ...(manifestCase.context
      ? {
          fixture: {
            dimensions: {
              countryId: dimensions?.countryId ?? 'SG',
              categoryId: dimensions?.categoryId ?? inferReviewDimensions(manifestCase.case_id).category_id,
            },
            content: {
              text: manifestCase.context.normalizedContent?.text,
              images: manifestCase.context.normalizedContent?.imageUrls ?? [],
            },
          },
        }
      : {}),
    provenance: {
      source: 'ad-manifest',
      golden_id: manifestCase.case_id,
      generated_at: generatedAt,
    },
  };
}

function inferReviewDimensions(caseId) {
  if (caseId.startsWith('sg-health') || caseId.includes('supplement')) {
    return { country_id: 'SG', category_id: 'health.supplement' };
  }
  if (caseId.startsWith('AF-') || caseId.startsWith('sg-electronics')) {
    return { country_id: 'SG', category_id: 'electronics' };
  }
  return { country_id: 'SG', category_id: 'electronics' };
}

function buildSupplementalCase(entry, generatedAt) {
  const dims = inferReviewDimensions(entry.case_id);
  return {
    case_id: entry.case_id,
    skill_module: entry.skill_module,
    pattern_id: entry.pattern_id,
    expected_rule: entry.expected_rule,
    expected_decision: entry.expected_decision,
    expected_severity: entry.expected_severity ?? 'MEDIUM',
    verified_by_legal: entry.verified_by_legal ?? false,
    exclude_from_strict_linkage: entry.exclude_from_strict_linkage ?? false,
    text: entry.text,
    issue: entry.issue ?? entry.case_id,
    modality: entry.modality ?? 'text',
    country_id: entry.country_id ?? dims.country_id,
    category_id: entry.category_id ?? dims.category_id,
    ...(entry.mapping_note ? { mapping_note: entry.mapping_note } : {}),
    provenance: {
      source: entry.source ?? 'supplemental',
      golden_id: entry.case_id,
      generated_at: generatedAt,
    },
  };
}

const goldenCases = JSON.parse(readFileSync(goldenPath, 'utf8'));
const taxonomy = JSON.parse(readFileSync(taxonomyPath, 'utf8'));
const overridesFile = JSON.parse(readFileSync(overridesPath, 'utf8'));
const overrides = overridesFile.overrides ?? {};
const supplementalFromOverrides = overridesFile.supplemental_cases ?? [];

const generatedAt = new Date().toISOString();
const unmappedIssues = [];

const casesById = new Map();

for (const golden of goldenCases) {
  if (!taxonomy.golden_issue_map[golden.issue]) {
    unmappedIssues.push({ id: golden.id, issue: golden.issue });
  }
  casesById.set(golden.id, buildGoldenCase(golden, taxonomy, overrides, generatedAt));
}

if (unmappedIssues.length > 0) {
  console.error('Unmapped golden issues:', unmappedIssues);
  process.exit(1);
}

if (existsSync(adManifestPath)) {
  const adManifest = JSON.parse(readFileSync(adManifestPath, 'utf8'));
  for (const manifestCase of adManifest.cases ?? []) {
    if (casesById.has(manifestCase.case_id)) {
      continue;
    }
    casesById.set(
      manifestCase.case_id,
      buildAdManifestSupplement(manifestCase, taxonomy, generatedAt),
    );
  }
}

for (const supplemental of supplementalFromOverrides) {
  if (!casesById.has(supplemental.case_id)) {
    casesById.set(supplemental.case_id, buildSupplementalCase(supplemental, generatedAt));
  }
}

const cases = [...casesById.values()].map((benchmarkCase) => {
  const override = overrides[benchmarkCase.case_id];
  if (!override) {
    return benchmarkCase;
  }
  return {
    ...benchmarkCase,
    ...(override.skill_module !== undefined ? { skill_module: override.skill_module } : {}),
    ...(override.pattern_id !== undefined ? { pattern_id: override.pattern_id } : {}),
    ...(override.expected_rule !== undefined ? { expected_rule: override.expected_rule } : {}),
    ...(override.expected_decision !== undefined ? { expected_decision: override.expected_decision } : {}),
    ...(override.expected_severity !== undefined ? { expected_severity: override.expected_severity } : {}),
    ...(override.verified_by_legal !== undefined ? { verified_by_legal: override.verified_by_legal } : {}),
    ...(override.exclude_from_strict_linkage !== undefined
      ? { exclude_from_strict_linkage: override.exclude_from_strict_linkage }
      : {}),
    ...(override.country_id !== undefined ? { country_id: override.country_id } : {}),
    ...(override.category_id !== undefined ? { category_id: override.category_id } : {}),
    ...(override.mapping_note !== undefined ? { mapping_note: override.mapping_note } : {}),
  };
});

const contentBody = {
  schema_version: '2.0.0',
  benchmark_id: 'aairp-benchmark-v2',
  taxonomy_version: taxonomy.modules_version ?? taxonomy.taxonomy_version,
  description:
    'Auto-generated from golden-benchmark-v1-cases.json, skill-taxonomy.json, and supplemental sources',
  generated_at: generatedAt,
  source: {
    golden_path: 'scripts/golden-benchmark-v1-cases.json',
    taxonomy_path: 'docs/knowledge/skill-modules.json',
    overrides_path: 'benchmark/benchmark-v2.overrides.json',
    ad_manifest_path: 'benchmark/ad-manifest.json',
  },
  case_count: cases.length,
  cases,
};

const content = `${JSON.stringify(contentBody, null, 2)}\n`;
const fingerprint = createHash('sha256').update(content).digest('hex');
const manifest = { ...contentBody, content_fingerprint: fingerprint };

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${outputPath} (${cases.length} cases, fingerprint ${fingerprint.slice(0, 12)}…)`);
