import { describe, expect, it } from 'vitest';
import {
  defaultBenchmarkManifestPath,
  loadBenchmarkManifest,
  selectBenchmarkCases,
} from './load-benchmark.js';

describe('loadBenchmarkManifest', () => {
  it('loads benchmark/ad-manifest.json with schema version and cases', () => {
    const manifest = loadBenchmarkManifest(defaultBenchmarkManifestPath());

    expect(manifest.schema_version).toBe('1.0.0');
    expect(manifest.benchmark_id).toBe('aairp-demo-benchmark');
    expect(manifest.cases.length).toBeGreaterThanOrEqual(6);
    expect(manifest.regression_subset?.length).toBeGreaterThanOrEqual(5);
  });

  it('selects regression subset only', () => {
    const manifest = loadBenchmarkManifest(defaultBenchmarkManifestPath());
    const subset = selectBenchmarkCases(manifest, { regressionOnly: true });

    expect(subset.length).toBe(manifest.regression_subset?.length);
    for (const benchmarkCase of subset) {
      expect(manifest.regression_subset).toContain(benchmarkCase.case_id);
    }
  });
});
