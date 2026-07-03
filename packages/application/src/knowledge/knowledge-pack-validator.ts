import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listRegisteredCorpusTypes, requireCorpusPlugin } from './platform/knowledge-platform.js';
import { fingerprintBody } from './knowledge-pack-fingerprint.js';
import {
  loadReleasedKnowledgePack,
  repoRoot,
  type KnowledgePackV2,
} from './knowledge-pack.js';

export type PackValidationIssue = {
  tier: 'T0' | 'T1' | 'T2' | 'T3';
  severity: 'error' | 'warn';
  code: string;
  message: string;
};

export type PackValidationResult = {
  validated_at: string;
  knowledge_pack_id: string;
  passed: boolean;
  error_count: number;
  warn_count: number;
  issues: PackValidationIssue[];
};

function compareSchemaVersion(actual: string, minimum: string): boolean {
  const parse = (value: string): number[] =>
    value.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(actual);
  const b = parse(minimum);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? 0;
    const right = b[index] ?? 0;
    if (left > right) {
      return true;
    }
    if (left < right) {
      return false;
    }
  }
  return true;
}

export function validateKnowledgePack(
  pack: KnowledgePackV2,
  options?: { now?: Date; checkLiveManifests?: boolean },
): PackValidationResult {
  const now = options?.now ?? new Date();
  const issues: PackValidationIssue[] = [];
  const checkLive = options?.checkLiveManifests ?? pack.release_status !== 'released';

  const expectedFingerprint = fingerprintBody(pack);
  if (pack.knowledge_pack_fingerprint !== expectedFingerprint) {
    issues.push({
      tier: 'T0',
      severity: 'error',
      code: 'fingerprint_mismatch',
      message: 'knowledge_pack_fingerprint does not match canonical pack body',
    });
  }

  if (pack.knowledge_pack_id !== pack.knowledge_pack_version) {
    issues.push({
      tier: 'T0',
      severity: 'error',
      code: 'pack_id_version_mismatch',
      message: 'knowledge_pack_id must equal knowledge_pack_version',
    });
  }

  if (!/^kp-\d{4}\.\d{2}\.\d+$/.test(pack.knowledge_pack_id)) {
    issues.push({
      tier: 'T0',
      severity: 'error',
      code: 'invalid_pack_id_format',
      message: `knowledge_pack_id must match kp-YYYY.MM.N: ${pack.knowledge_pack_id}`,
    });
  }

  const requiredCorpora = listRegisteredCorpusTypes();
  for (const corpusType of requiredCorpora) {
    if (!pack.corpora[corpusType]) {
      issues.push({
        tier: 'T0',
        severity: 'error',
        code: 'missing_corpus_snapshot',
        message: `Missing corpus snapshot: ${corpusType}`,
      });
    }
  }

  if (checkLive) {
    for (const corpusType of requiredCorpora) {
      const snapshot = pack.corpora[corpusType];
      if (!snapshot) {
        continue;
      }
      const plugin = requireCorpusPlugin(corpusType);
      const bundle = plugin.load();
      const liveManifest = plugin.buildManifest(bundle.entries, bundle.root, now);
      if (liveManifest.fingerprint !== snapshot.fingerprint) {
        issues.push({
          tier: 'T0',
          severity: 'error',
          code: 'corpus_fingerprint_mismatch',
          message: `Live ${corpusType} manifest fingerprint differs from pack snapshot`,
        });
      }

      const validation = plugin.validate(bundle.entries, {
        now,
        knownRuleIds: plugin.knownRuleIds?.(),
      });
      if (validation.error_count > 0) {
        issues.push({
          tier: 'T0',
          severity: 'error',
          code: 'corpus_validation_failed',
          message: `${corpusType} corpus has ${validation.error_count} validation error(s)`,
        });
      }
      if (snapshot.validation.errors > 0) {
        issues.push({
          tier: 'T0',
          severity: 'error',
          code: 'snapshot_reports_corpus_errors',
          message: `${corpusType} snapshot records ${snapshot.validation.errors} validation error(s)`,
        });
      }
    }
  } else if (pack.release_status === 'released') {
    for (const corpusType of requiredCorpora) {
      const snapshot = pack.corpora[corpusType];
      if (snapshot?.validation.errors) {
        issues.push({
          tier: 'T0',
          severity: 'error',
          code: 'snapshot_reports_corpus_errors',
          message: `Released pack ${corpusType} snapshot records validation errors`,
        });
      }
    }
  }

  for (const requirement of pack.compatibility.required_corpora) {
    const snapshot = pack.corpora[requirement.corpus_type];
    if (!snapshot) {
      continue;
    }
    if (!compareSchemaVersion(snapshot.schema_version, requirement.min_schema_version)) {
      issues.push({
        tier: 'T1',
        severity: 'error',
        code: 'incompatible_corpus_schema',
        message: `${requirement.corpus_type} schema ${snapshot.schema_version} below required ${requirement.min_schema_version}`,
      });
    }
  }

  const baselinePath = join(repoRoot(), 'benchmark/benchmark-v3-baseline.json');
  if (!existsSync(baselinePath)) {
    issues.push({
      tier: 'T2',
      severity: 'warn',
      code: 'missing_regression_baseline_ref',
      message: 'Regression baseline file benchmark/benchmark-v3-baseline.json not found',
    });
  } else {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { baseline_id?: string };
    if (baseline.baseline_id && pack.evaluation_linkage.regression_baseline_ref !== baseline.baseline_id) {
      issues.push({
        tier: 'T2',
        severity: 'warn',
        code: 'regression_baseline_ref_drift',
        message: `regression_baseline_ref ${pack.evaluation_linkage.regression_baseline_ref} differs from baseline file`,
      });
    }
  }

  const coverage = pack.evaluation_linkage.case_corpus.benchmark_coverage;
  if (coverage.pct < 50) {
    issues.push({
      tier: 'T2',
      severity: 'warn',
      code: 'low_benchmark_coverage',
      message: `Case corpus benchmark coverage ${coverage.covered}/${coverage.total} (${coverage.pct}%)`,
    });
  }

  for (const corpusType of requiredCorpora) {
    const snapshot = pack.corpora[corpusType];
    if (!snapshot) {
      continue;
    }
    if (snapshot.knowledge_quality_score < 50) {
      issues.push({
        tier: 'T3',
        severity: 'warn',
        code: 'low_corpus_kqs',
        message: `${corpusType} KQS ${snapshot.knowledge_quality_score}% below maturity threshold`,
      });
    }
    if (snapshot.validation.warnings > 0) {
      issues.push({
        tier: 'T3',
        severity: 'warn',
        code: 'corpus_governance_warnings',
        message: `${corpusType} has ${snapshot.validation.warnings} governance warning(s)`,
      });
    }
  }

  if (pack.supersedes) {
    const issuesFromSupersedes = validateSupersedesChain(pack);
    issues.push(...issuesFromSupersedes);
  }

  const error_count = issues.filter((issue) => issue.severity === 'error').length;
  const warn_count = issues.filter((issue) => issue.severity === 'warn').length;

  return {
    validated_at: now.toISOString(),
    knowledge_pack_id: pack.knowledge_pack_id,
    passed: error_count === 0,
    error_count,
    warn_count,
    issues,
  };
}

export function validateSupersedesChain(pack: KnowledgePackV2): PackValidationIssue[] {
  const issues: PackValidationIssue[] = [];
  if (!pack.supersedes) {
    return issues;
  }

  const prior = loadReleasedKnowledgePack(pack.supersedes);
  if (!prior) {
    issues.push({
      tier: 'T1',
      severity: 'error',
      code: 'supersedes_unreleased',
      message: `supersedes references unknown or unreleased pack: ${pack.supersedes}`,
    });
    return issues;
  }

  if (prior.release_status !== 'released' && prior.release_status !== 'deprecated') {
    issues.push({
      tier: 'T1',
      severity: 'error',
      code: 'supersedes_unreleased',
      message: `supersedes target ${pack.supersedes} is not a released pack`,
    });
  }

  const visited = new Set<string>([pack.knowledge_pack_id]);
  let cursor: string | undefined = pack.supersedes;
  while (cursor) {
    if (visited.has(cursor)) {
      issues.push({
        tier: 'T1',
        severity: 'error',
        code: 'circular_supersedes',
        message: `Circular supersedes chain detected at ${cursor}`,
      });
      break;
    }
    visited.add(cursor);
    const node = loadReleasedKnowledgePack(cursor);
    cursor = node?.supersedes;
  }

  return issues;
}

export function validateReleaseMutation(
  packId: string,
  existing: KnowledgePackV2 | null,
): PackValidationIssue[] {
  if (!existing) {
    return [];
  }
  if (existing.release_status === 'released' || existing.release_status === 'deprecated') {
    return [
      {
        tier: 'T0',
        severity: 'error',
        code: 'released_pack_immutable',
        message: `Released pack ${packId} cannot be modified`,
      },
    ];
  }
  return [];
}
