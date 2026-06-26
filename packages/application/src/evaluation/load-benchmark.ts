import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BenchmarkCase, BenchmarkManifest } from './benchmark-types.js';

function assertManifest(raw: unknown): BenchmarkManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('benchmark manifest must be a JSON object');
  }

  const manifest = raw as BenchmarkManifest;

  if (typeof manifest.schema_version !== 'string' || manifest.schema_version.length === 0) {
    throw new Error('benchmark manifest requires schema_version');
  }
  if (typeof manifest.benchmark_id !== 'string' || manifest.benchmark_id.length === 0) {
    throw new Error('benchmark manifest requires benchmark_id');
  }
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    throw new Error('benchmark manifest requires a non-empty cases array');
  }

  for (const benchmarkCase of manifest.cases) {
    if (!benchmarkCase.case_id || !benchmarkCase.ground_truth?.expected_decision) {
      throw new Error(`invalid benchmark case: missing case_id or expected_decision`);
    }
  }

  return manifest;
}

export function loadBenchmarkManifest(manifestPath: string): BenchmarkManifest {
  const content = readFileSync(manifestPath, 'utf8');
  return assertManifest(JSON.parse(content));
}

export function selectBenchmarkCases(
  manifest: BenchmarkManifest,
  options?: { caseIds?: string[]; regressionOnly?: boolean },
): BenchmarkCase[] {
  if (options?.caseIds && options.caseIds.length > 0) {
    const idSet = new Set(options.caseIds);
    return manifest.cases.filter((benchmarkCase) => idSet.has(benchmarkCase.case_id));
  }

  if (options?.regressionOnly && manifest.regression_subset?.length) {
    const idSet = new Set(manifest.regression_subset);
    return manifest.cases.filter((benchmarkCase) => idSet.has(benchmarkCase.case_id));
  }

  return manifest.cases;
}

export function defaultBenchmarkManifestPath(): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../benchmark/ad-manifest.json',
  );
}
