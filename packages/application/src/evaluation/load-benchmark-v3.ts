import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RewriteExpectation } from '../knowledge/rewrite-templates.js';

export type BenchmarkV3Tier = 'regression' | 'extended' | 'candidate' | 'pilot' | 'locale-expansion';

export type BenchmarkV3LifecycleStatus =
  | 'MAINTAINED'
  | 'BENCHMARK_CANDIDATE'
  | 'HUMAN_VERIFIED'
  | 'DEMOTED';

export type BenchmarkV3Case = {
  case_id: string;
  expected_skill: string;
  expected_pattern: string | null;
  expected_rule: string | null;
  expected_decision: 'PASS' | 'WARN' | 'REJECT' | 'REVIEW';
  expected_severity: string;
  expected_action: string;
  expected_rewrite: RewriteExpectation;
  evaluation_weight: number;
  tier: BenchmarkV3Tier;
  lifecycle_status: BenchmarkV3LifecycleStatus;
  verified_by_legal: boolean;
  exclude_from_strict_linkage?: boolean;
  country_id?: string;
  category_id?: string;
  text: string;
  risk?: string;
  issue?: string;
  modality: string;
  fixture?: Record<string, unknown>;
  provenance: Record<string, string>;
  mapping_note?: string;
};

export type EvaluationProfile = {
  dimensions: string[];
  default_weights: Record<string, number>;
};

export type BenchmarkV3Manifest = {
  schema_version: string;
  benchmark_id: string;
  modules_version: string;
  description: string;
  generated_at: string;
  content_fingerprint: string;
  evaluation_profile: EvaluationProfile;
  source: Record<string, string>;
  case_count: number;
  cases: BenchmarkV3Case[];
};

const defaultPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../benchmark/benchmark-v3.json',
);

export function resolveBenchmarkV3Path(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  if (process.env.AAIRP_BENCHMARK_V3_PATH) {
    return process.env.AAIRP_BENCHMARK_V3_PATH;
  }
  return defaultPath;
}

export function loadBenchmarkV3(customPath?: string): BenchmarkV3Manifest {
  const path = resolveBenchmarkV3Path(customPath);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as BenchmarkV3Manifest;
  if (raw.schema_version !== '3.0.0') {
    throw new Error(`unsupported benchmark v3 schema: ${raw.schema_version}`);
  }
  return raw;
}

export function selectBenchmarkV3Cases(
  manifest: BenchmarkV3Manifest,
  options?: { tier?: BenchmarkV3Tier; caseIds?: string[] },
): BenchmarkV3Case[] {
  if (options?.caseIds?.length) {
    const ids = new Set(options.caseIds);
    return manifest.cases.filter((c) => ids.has(c.case_id));
  }
  if (options?.tier) {
    return manifest.cases.filter((c) => c.tier === options.tier);
  }
  return manifest.cases;
}

export function strictLinkageV3Cases(manifest: BenchmarkV3Manifest): BenchmarkV3Case[] {
  return manifest.cases.filter((c) => !c.exclude_from_strict_linkage);
}
