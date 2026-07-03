import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type BenchmarkV2Case = {
  case_id: string;
  skill_module: string;
  pattern_id: string | null;
  expected_rule: string | null;
  expected_decision: 'PASS' | 'WARN' | 'REJECT' | 'REVIEW';
  expected_severity: string;
  verified_by_legal: boolean;
  exclude_from_strict_linkage?: boolean;
  text: string;
  risk: string;
  issue: string;
  modality: string;
  fixture?: Record<string, unknown>;
  provenance: {
    source: string;
    golden_id: string;
    generated_at: string;
  };
  mapping_note?: string;
};

export type BenchmarkV2Manifest = {
  schema_version: string;
  benchmark_id: string;
  taxonomy_version: string;
  description: string;
  generated_at: string;
  content_fingerprint: string;
  source: Record<string, string>;
  case_count: number;
  cases: BenchmarkV2Case[];
};

const defaultBenchmarkV2Path = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../benchmark/benchmark-v2.json',
);

export function resolveBenchmarkV2Path(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  if (process.env.AAIRP_BENCHMARK_V2_PATH) {
    return process.env.AAIRP_BENCHMARK_V2_PATH;
  }
  return defaultBenchmarkV2Path;
}

export function loadBenchmarkV2(customPath?: string): BenchmarkV2Manifest {
  const path = resolveBenchmarkV2Path(customPath);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as BenchmarkV2Manifest;
  if (raw.schema_version !== '2.0.0') {
    throw new Error(`unsupported benchmark v2 schema: ${raw.schema_version}`);
  }
  if (!Array.isArray(raw.cases) || raw.cases.length === 0) {
    throw new Error('benchmark v2 requires a non-empty cases array');
  }
  return raw;
}

export function strictLinkageCases(manifest: BenchmarkV2Manifest): BenchmarkV2Case[] {
  return manifest.cases.filter((c) => !c.exclude_from_strict_linkage);
}
