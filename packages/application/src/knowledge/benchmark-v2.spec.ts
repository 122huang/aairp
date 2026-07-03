import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadBenchmarkV2, strictLinkageCases } from './load-benchmark-v2.js';
import { loadSkillModules } from './skill-modules.js';

describe('Benchmark V2 (E3)', () => {
  const manifest = loadBenchmarkV2();
  const modules = loadSkillModules();
  const goldenPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../scripts/golden-benchmark-v1-cases.json',
  );
  const goldenCases = JSON.parse(readFileSync(goldenPath, 'utf8')) as Array<{ id: string }>;

  it('matches golden case count (plus supplemental sources)', () => {
    expect(manifest.case_count).toBeGreaterThanOrEqual(goldenCases.length);
    expect(manifest.cases.length).toBeGreaterThanOrEqual(goldenCases.length);
  });

  it('references current modules version', () => {
    expect(manifest.taxonomy_version).toBe(modules.modules_version);
  });

  it('assigns skill_module and expected_decision on every case', () => {
    for (const benchmarkCase of manifest.cases) {
      expect(benchmarkCase.skill_module.length).toBeGreaterThan(0);
      expect(benchmarkCase.expected_decision).toBeTruthy();
    }
  });

  it('marks internal-note cases for relaxed linkage', () => {
    const internal = manifest.cases.filter((c) => c.issue === 'Internal Note');
    expect(internal.length).toBeGreaterThan(0);
    expect(internal.every((c) => c.exclude_from_strict_linkage)).toBe(true);
  });

  it('has strict-linkage cases with full linkage fields', () => {
    const strict = strictLinkageCases(manifest);
    expect(strict.length).toBeGreaterThan(0);
    for (const benchmarkCase of strict) {
      expect(benchmarkCase.pattern_id, benchmarkCase.case_id).toBeTruthy();
      expect(benchmarkCase.expected_decision, benchmarkCase.case_id).toBeTruthy();
    }
  });
});
