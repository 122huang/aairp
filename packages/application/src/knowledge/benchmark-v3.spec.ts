import { describe, expect, it } from 'vitest';
import { loadBenchmarkV3, selectBenchmarkV3Cases } from '../evaluation/load-benchmark-v3.js';
import { loadSkillModules } from './skill-modules.js';

describe('Benchmark V3 (E3)', () => {
  const manifest = loadBenchmarkV3();
  const modules = loadSkillModules();

  it('references current modules version', () => {
    expect(manifest.modules_version).toBe(modules.modules_version);
  });

  it('assigns expected_skill and expected_action on every case', () => {
    for (const benchmarkCase of manifest.cases) {
      expect(benchmarkCase.expected_skill.length).toBeGreaterThan(0);
      expect(benchmarkCase.expected_action).toBeTruthy();
    }
  });

  it('includes regression tier cases', () => {
    const regression = selectBenchmarkV3Cases(manifest, { tier: 'regression' });
    expect(regression.length).toBeGreaterThan(0);
    expect(regression.every((c) => c.tier === 'regression')).toBe(true);
  });

  it('includes locale-expansion tier cases from 6B-2f', () => {
    const localeExpansion = selectBenchmarkV3Cases(manifest, { tier: 'locale-expansion' });
    expect(localeExpansion).toHaveLength(20);
    expect(localeExpansion.every((c) => c.tier === 'locale-expansion')).toBe(true);
    expect(localeExpansion.map((c) => c.case_id)).toContain('id-sa-warn-category-boundary');
    expect(localeExpansion.map((c) => c.case_id)).toContain('vn-sa-review-foreign-brand');
    expect(localeExpansion.map((c) => c.case_id)).toContain('ph-sa-warn-health-implication');
    expect(localeExpansion.map((c) => c.case_id)).toContain('my-sa-info-sponsored-disclosure');
  });

  it('matches v2 case count plus locale-expansion tier', () => {
    expect(manifest.case_count).toBeGreaterThanOrEqual(102);
    expect(manifest.cases.length).toBe(manifest.case_count);
  });
});
