import { describe, expect, it } from 'vitest';
import {
  computeRewriteFreshnessBand,
  computeRewriteFreshnessStats,
  isStaleKnowledge,
} from './rewrite-corpus-freshness.js';
import {
  scoreRewriteCorpusKqs,
  scoreRewriteEntryKqs,
} from './rewrite-corpus-kqs.js';
import { buildRewriteCorpusManifest } from './rewrite-corpus-index.js';
import { buildRewriteCoverageReport } from './rewrite-corpus-coverage.js';
import { validateRewriteCorpus } from './rewrite-corpus-validator.js';
import { buildRewriteCorpusDashboard } from './rewrite-corpus-dashboard.js';
import { buildRewriteDriftReport } from './rewrite-corpus-drift.js';
import { loadRewriteCorpusEntries } from './rewrite-corpus.js';
import { buildKnowledgePlatformSnapshot } from './platform/knowledge-platform.js';
import { validateSkillCorpus } from './skill-corpus-validator.js';

const NOW = new Date('2026-07-01T12:00:00.000Z');

describe('Rewrite freshness', () => {
  it('classifies green/yellow/red bands', () => {
    expect(computeRewriteFreshnessBand('2026-06-01T00:00:00.000Z', NOW)).toBe('green');
    expect(computeRewriteFreshnessBand('2025-12-01T00:00:00.000Z', NOW)).toBe('yellow');
    expect(computeRewriteFreshnessBand('2024-01-01T00:00:00.000Z', NOW)).toBe('red');
    expect(isStaleKnowledge('2024-01-01T00:00:00.000Z', NOW)).toBe(true);
  });
});

describe('Rewrite governance integration', () => {
  const entries = loadRewriteCorpusEntries();

  it('builds manifest for nine entries', () => {
    const manifest = buildRewriteCorpusManifest({ now: NOW });
    expect(manifest.entry_count).toBe(9);
    expect(manifest.fingerprint).toHaveLength(16);
  });

  it('validates corpus without errors', () => {
    const result = validateRewriteCorpus({ now: NOW });
    expect(result.passed).toBe(true);
    expect(result.error_count).toBe(0);
  });

  it('validates skill corpus after rewrite registration', () => {
    const skillResult = validateSkillCorpus({ now: NOW });
    expect(skillResult.passed).toBe(true);
    expect(skillResult.error_count).toBe(0);
  });

  it('builds coverage and dashboard', () => {
    const report = buildRewriteCoverageReport({ now: NOW });
    expect(report.corpus_size).toBe(9);
    expect(report.missing_strategies).toHaveLength(0);

    const dashboard = buildRewriteCorpusDashboard({ now: NOW });
    expect(dashboard.validation.passed).toBe(true);
  });

  it('produces non-blocking drift report with zero measurable drift', () => {
    const drift = buildRewriteDriftReport({ now: NOW });
    expect(drift.rewrite_corpus_count).toBe(9);
    expect(drift.summary.measurable_criteria_drift).toBe(0);
  });

  it('includes rewrite corpus in platform snapshot', () => {
    const snapshot = buildKnowledgePlatformSnapshot(NOW);
    expect(snapshot.corpora).toHaveLength(5);
    const rewrite = snapshot.corpora.find((item) => item.corpus_type === 'rewrite');
    expect(rewrite?.entry_count).toBe(9);
    const evidence = snapshot.corpora.find((item) => item.corpus_type === 'evidence');
    expect(evidence?.entry_count).toBe(20);
    expect(rewrite?.validation_errors).toBe(0);
  });

  it('scores full corpus KQS', () => {
    const kqs = scoreRewriteCorpusKqs(entries);
    expect(kqs.entry_count).toBe(9);
    expect(kqs.overall).toBeGreaterThan(80);
    expect(scoreRewriteEntryKqs(entries[0]!).overall).toBeGreaterThan(80);
  });

  it('computes freshness stats', () => {
    const stats = computeRewriteFreshnessStats(entries, NOW);
    expect(stats.green).toBe(9);
  });
});
