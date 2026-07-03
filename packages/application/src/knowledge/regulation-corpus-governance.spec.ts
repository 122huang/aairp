import { describe, expect, it } from 'vitest';
import {
  computeRegulationFreshnessBand,
  computeRegulationFreshnessStats,
  isStaleKnowledge,
} from './regulation-corpus-freshness.js';
import {
  hasConfidenceTag,
  scoreRegulationCorpusKqs,
  scoreRegulationEntryKqs,
} from './regulation-corpus-kqs.js';
import { buildRegulationCorpusManifest } from './regulation-corpus-index.js';
import { buildRegulationCoverageReport } from './regulation-corpus-coverage.js';
import { validateRegulationCorpus } from './regulation-corpus-validator.js';
import { buildRegulationCorpusDashboard } from './regulation-corpus-dashboard.js';
import { loadRegulationCorpusEntries, type RegulationCorpusEntry } from './regulation-corpus.js';

const NOW = new Date('2026-06-29T12:00:00.000Z');

function sampleEntry(overrides: Partial<RegulationCorpusEntry> = {}): RegulationCorpusEntry {
  return {
    knowledge_id: 'regulation:test-entry',
    corpus_type: 'regulation',
    regulation_id: 'test-entry',
    country: 'SG',
    authority: 'HSA',
    regulation_name: 'Test Act',
    citation: 'Test Act — Section 1',
    effective_date: '2020-01-01',
    category: 'Health Claims',
    mandatory: true,
    risk_level: 'MEDIUM',
    summary: 'Health benefit claims must be truthful and substantiated before publication in ads.',
    review_guidance:
      'TRIGGER: Wellness claims. ACTION: WARN. CHECK: Copy and labels. ESCALATE IF: disease implied.',
    related_rule_ids: ['demo-sg-health-forbidden-claim'],
    pending_rule_ids: [],
    related_evidence_ids: [],
    owner: 'legal-apac@aairp',
    owner_type: 'legal',
    last_reviewed: '2026-06-01T00:00:00.000Z',
    review_status: 'legal_reviewed',
    source_url: 'https://example.gov.sg/test',
    tags: ['confidence:high', 'evidence:required'],
    ...overrides,
  };
}

describe('Regulation freshness (E3–E5)', () => {
  it('classifies green/yellow/red bands', () => {
    expect(computeRegulationFreshnessBand('2026-01-01T00:00:00.000Z', NOW)).toBe('green');
    expect(computeRegulationFreshnessBand('2025-12-01T00:00:00.000Z', NOW)).toBe('yellow');
    expect(computeRegulationFreshnessBand('2024-01-01T00:00:00.000Z', NOW)).toBe('red');
    expect(isStaleKnowledge('2024-01-01T00:00:00.000Z', NOW)).toBe(true);
  });
});

describe('Regulation KQS (E3–E5)', () => {
  it('scores a complete entry highly', () => {
    const score = scoreRegulationEntryKqs(sampleEntry());
    expect(score.overall).toBeGreaterThan(85);
    expect(score.dimensions.rule_linkage).toBe(100);
  });

  it('penalizes missing classification tags', () => {
    const score = scoreRegulationEntryKqs(sampleEntry({ tags: [] }));
    expect(score.dimensions.confidence_classification).toBe(0);
    expect(score.dimensions.evidence_classification).toBe(0);
    expect(hasConfidenceTag(sampleEntry({ tags: [] }))).toBe(false);
  });
});

describe('Regulation governance integration (E3–E5)', () => {
  const entries = loadRegulationCorpusEntries();

  it('builds manifest for 85 entries', () => {
    const manifest = buildRegulationCorpusManifest({ now: NOW });
    expect(manifest.entry_count).toBe(85);
    expect(manifest.fingerprint).toHaveLength(16);
    expect(manifest.knowledge_quality_score).toBeGreaterThan(0);
  });

  it('builds coverage report with freshness and KQS', () => {
    const report = buildRegulationCoverageReport({ now: NOW });
    expect(report.corpus_size).toBe(85);
    expect(report.country_coverage).toHaveLength(9);
    expect(report.missing_countries).toHaveLength(0);
    expect(report.freshness.green).toBe(85);
    expect(report.knowledge_quality_score.overall).toBeGreaterThan(70);
  });

  it('validates corpus without errors', () => {
    const result = validateRegulationCorpus({ now: NOW });
    expect(result.passed).toBe(true);
    expect(result.error_count).toBe(0);
  });

  it('reports governance warnings for orphan regulations', () => {
    const result = validateRegulationCorpus({ now: NOW });
    expect(result.governance_warnings.some((issue) => issue.code === 'orphan_entry')).toBe(
      true,
    );
  });

  it('builds integrated dashboard', () => {
    const dashboard = buildRegulationCorpusDashboard({ now: NOW });
    expect(dashboard.coverage.corpus_size).toBe(85);
    expect(dashboard.manifest.entry_count).toBe(85);
    expect(dashboard.entries_by_freshness.green.length).toBe(85);
    expect(Object.keys(dashboard.ownership_by_type).length).toBeGreaterThan(0);
  });

  it('scores full corpus KQS', () => {
    const kqs = scoreRegulationCorpusKqs(entries);
    expect(kqs.entry_count).toBe(85);
    expect(kqs.dimension_averages.citation_completeness).toBeGreaterThan(80);
  });

  it('computes freshness stats for corpus', () => {
    const stats = computeRegulationFreshnessStats(entries, NOW);
    expect(stats.green + stats.yellow + stats.red).toBe(85);
  });
});
