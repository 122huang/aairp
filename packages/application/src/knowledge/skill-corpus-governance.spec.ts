import { describe, expect, it } from 'vitest';
import {
  computeSkillFreshnessBand,
  computeSkillFreshnessStats,
  isStaleKnowledge,
} from './skill-corpus-freshness.js';
import {
  hasConfidenceTag,
  scoreSkillCorpusKqs,
  scoreSkillEntryKqs,
} from './skill-corpus-kqs.js';
import { buildSkillCorpusManifest } from './skill-corpus-index.js';
import { buildSkillCoverageReport } from './skill-corpus-coverage.js';
import { validateSkillCorpus } from './skill-corpus-validator.js';
import { buildSkillCorpusDashboard } from './skill-corpus-dashboard.js';
import { buildSkillDriftReport } from './skill-corpus-drift.js';
import { loadSkillCorpusEntries, type SkillCorpusEntry } from './skill-corpus.js';
import { buildKnowledgePlatformSnapshot } from './platform/knowledge-platform.js';

const NOW = new Date('2026-06-29T12:00:00.000Z');

function sampleEntry(): SkillCorpusEntry {
  return loadSkillCorpusEntries()[0]!;
}

describe('Skill freshness', () => {
  it('classifies green/yellow/red bands', () => {
    expect(computeSkillFreshnessBand('2026-01-01T00:00:00.000Z', NOW)).toBe('green');
    expect(computeSkillFreshnessBand('2025-12-01T00:00:00.000Z', NOW)).toBe('yellow');
    expect(computeSkillFreshnessBand('2024-01-01T00:00:00.000Z', NOW)).toBe('red');
    expect(isStaleKnowledge('2024-01-01T00:00:00.000Z', NOW)).toBe(true);
  });
});

describe('Skill KQS', () => {
  it('scores a complete entry highly', () => {
    const score = scoreSkillEntryKqs(sampleEntry());
    expect(score.overall).toBeGreaterThan(80);
    expect(score.dimensions.regulation_linkage).toBe(100);
  });

  it('penalizes missing classification fields', () => {
    const entry = { ...sampleEntry(), confidence_level: undefined, evidence_requirement: undefined, tags: [] };
    const score = scoreSkillEntryKqs(entry);
    expect(score.dimensions.confidence_classification).toBe(0);
    expect(hasConfidenceTag(entry)).toBe(false);
  });
});

describe('Skill governance integration', () => {
  const entries = loadSkillCorpusEntries();

  it('builds manifest for five entries', () => {
    const manifest = buildSkillCorpusManifest({ now: NOW });
    expect(manifest.entry_count).toBe(5);
    expect(manifest.fingerprint).toHaveLength(16);
    expect(manifest.knowledge_quality_score).toBeGreaterThan(0);
  });

  it('builds coverage report with freshness and KQS', () => {
    const report = buildSkillCoverageReport({ now: NOW });
    expect(report.corpus_size).toBe(5);
    expect(report.missing_claim_types).toHaveLength(0);
    expect(report.freshness.green).toBe(5);
    expect(report.knowledge_quality_score.overall).toBeGreaterThan(70);
  });

  it('validates corpus without errors', () => {
    const result = validateSkillCorpus({ now: NOW });
    expect(result.passed).toBe(true);
    expect(result.error_count).toBe(0);
  });

  it('builds dashboard with validation summary', () => {
    const dashboard = buildSkillCorpusDashboard({ now: NOW });
    expect(dashboard.validation.passed).toBe(true);
    expect(dashboard.manifest.by_status.production).toBe(5);
  });

  it('produces non-blocking drift report', () => {
    const drift = buildSkillDriftReport({ now: NOW });
    expect(drift.skill_corpus_count).toBe(5);
    expect(drift.summary.skills_with_legacy_module).toBe(5);
  });

  it('includes skill corpus in platform snapshot', () => {
    const snapshot = buildKnowledgePlatformSnapshot(NOW);
    const skill = snapshot.corpora.find((item) => item.corpus_type === 'skill');
    expect(skill?.entry_count).toBe(5);
    expect(skill?.validation_errors).toBe(0);
  });

  it('scores full corpus KQS', () => {
    const kqs = scoreSkillCorpusKqs(entries);
    expect(kqs.entry_count).toBe(5);
    expect(kqs.overall).toBeGreaterThan(75);
  });

  it('computes freshness stats for corpus', () => {
    const stats = computeSkillFreshnessStats(entries, NOW);
    expect(stats.green).toBe(5);
  });
});
