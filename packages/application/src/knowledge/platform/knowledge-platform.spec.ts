import { describe, expect, it } from 'vitest';
import {
  buildKnowledgeId,
  parseKnowledgeId,
} from '../knowledge-corpus.js';
import {
  mergeKnowledgeLinkage,
  emptyKnowledgeLinkage,
  isOrphanLinkage,
} from './knowledge-linkage.js';
import { mapReviewStatusToLifecycle, snapshotLifecycle } from './knowledge-lifecycle.js';
import {
  resolveConfidenceLevel,
  resolveEvidenceRequirement,
} from './knowledge-classification.js';
import {
  computeFreshnessBand,
  computeFreshnessStats,
} from './governance/freshness.js';
import {
  scoreSharedSummaryCompleteness,
  scoreCorpusKqs,
  sharedClassificationDimensions,
} from './governance/kqs.js';
import {
  buildKnowledgePlatformSnapshot,
  listRegisteredCorpusTypes,
  requireCorpusPlugin,
} from './knowledge-platform.js';
import type { KnowledgeEntryBase } from './knowledge-entry.js';

const sampleEntry = (): KnowledgeEntryBase => ({
  knowledge_id: 'regulation:sample-entry',
  corpus_type: 'regulation',
  owner: 'legal-apac@aairp',
  owner_type: 'legal',
  last_reviewed: '2026-06-01T00:00:00.000Z',
  review_status: 'legal_reviewed',
  summary: 'Sample summary with enough length to score well for governance tests.',
  review_guidance: 'TRIGGER: test. ACTION: WARN. CHECK: copy. ESCALATE IF: needed.',
  tags: ['confidence:high', 'evidence:none'],
});

describe('Knowledge Platform Core (5B-E0)', () => {
  it('exposes shared linkage model', () => {
    const linkage = mergeKnowledgeLinkage(emptyKnowledgeLinkage(), {
      rules: ['demo-sg-health-forbidden-claim'],
      evidence: ['evidence:lab-report-1'],
    });
    expect(isOrphanLinkage(linkage)).toBe(false);
    expect(linkage.rules).toEqual(['demo-sg-health-forbidden-claim']);
  });

  it('maps lifecycle from legacy review_status', () => {
    expect(mapReviewStatusToLifecycle('draft')).toBe('draft');
    expect(snapshotLifecycle('legal_reviewed').stage).toBe('approved');
    expect(snapshotLifecycle('deprecated').stage).toBe('retired');
  });

  it('resolves classification from tags', () => {
    const entry = sampleEntry();
    expect(resolveConfidenceLevel(entry)).toBe('high');
    expect(resolveEvidenceRequirement(entry)).toBe('none');
  });

  it('scores shared governance dimensions', () => {
    expect(scoreSharedSummaryCompleteness(sampleEntry().summary)).toBeGreaterThan(0.7);
    const kqs = scoreCorpusKqs(
      [sampleEntry()],
      sharedClassificationDimensions(),
      (entry) => parseKnowledgeId(entry.knowledge_id)!.stable_key,
    );
    expect(kqs.overall).toBeGreaterThan(70);
  });

  it('computes unified freshness bands', () => {
    const now = new Date('2026-06-29T12:00:00.000Z');
    expect(computeFreshnessBand('2026-01-01T00:00:00.000Z', now)).toBe('green');
    const stats = computeFreshnessStats([sampleEntry()], now);
    expect(stats.green).toBe(1);
  });

  it('registers regulation, skill, rewrite, evidence, and case corpus plugins', () => {
    expect(listRegisteredCorpusTypes()).toContain('regulation');
    expect(listRegisteredCorpusTypes()).toContain('skill');
    expect(listRegisteredCorpusTypes()).toContain('rewrite');
    expect(listRegisteredCorpusTypes()).toContain('evidence');
    expect(listRegisteredCorpusTypes()).toContain('case');
    const plugin = requireCorpusPlugin('regulation');
    expect(plugin.corpus_type).toBe('regulation');
    expect(buildKnowledgeId('regulation', 'x')).toBe('regulation:x');
    expect(requireCorpusPlugin('skill').corpus_type).toBe('skill');
  });

  it('builds multi-corpus platform snapshot', () => {
    const snapshot = buildKnowledgePlatformSnapshot(new Date('2026-06-29T12:00:00.000Z'));
    expect(snapshot.platform_version).toBe('1.0.0');
    expect(snapshot.corpora.length).toBe(5);
    const regulation = snapshot.corpora.find((item) => item.corpus_type === 'regulation');
    const skill = snapshot.corpora.find((item) => item.corpus_type === 'skill');
    const rewrite = snapshot.corpora.find((item) => item.corpus_type === 'rewrite');
    const evidence = snapshot.corpora.find((item) => item.corpus_type === 'evidence');
    const caseCorpus = snapshot.corpora.find((item) => item.corpus_type === 'case');
    expect(regulation?.entry_count).toBe(85);
    expect(skill?.entry_count).toBe(5);
    expect(rewrite?.entry_count).toBe(9);
    expect(evidence?.entry_count).toBe(20);
    expect(caseCorpus?.entry_count).toBe(28);
  });
});
