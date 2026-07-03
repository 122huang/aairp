import { describe, expect, it } from 'vitest';
import {
  loadRewriteCorpus,
  loadRewriteCorpusEntries,
  normalizeRewriteCorpusEntry,
  requiresSkillLinkage,
  type RewriteCorpusEntry,
} from './rewrite-corpus.js';
import { rewriteEntryLinkage } from './corpus/rewrite-entry.adapter.js';
import { getCorpusPlugin, listRegisteredCorpusTypes } from './platform/knowledge-platform.js';

function sampleEntry(overrides: Partial<RewriteCorpusEntry> = {}): RewriteCorpusEntry {
  return {
    knowledge_id: 'rewrite:test-rewrite',
    corpus_type: 'rewrite',
    rewrite_id: 'test-rewrite',
    legacy_template_id: 'test-rewrite',
    rewrite_purpose: 'Guide reviewers to qualify test claims with substantiation framing in ads.',
    rewrite_status: 'production',
    rewrite_version: '1.0.0',
    rewrite_strategy_type: 'qualify',
    summary: 'Replace absolute test claim wording with qualified language supported by substantiation.',
    rewrite_guidance:
      'TRIGGER: Absolute test claims. ACTION: Qualify wording. CHECK: Substantiation file. ESCALATE IF: none on file.',
    review_guidance: 'ESCALATE IF: qualified wording still conflicts with on-pack label.',
    measurable_criteria: {
      must_remove_terms: ['guaranteed'],
      must_include_concepts: ['typical'],
    },
    benchmark_refs: ['AF-003'],
    case_refs: [],
    linkage: {
      regulations: ['regulation:sg-asas-comparative-claims'],
      rules: ['demo-apac-sa-comparative-claim'],
      skills: ['skill:comparative-claim-review'],
    },
    expected_evidence_type: 'substantiation_general',
    evidence_requirement: 'recommended',
    owner: 'legal-apac@aairp',
    owner_type: 'legal',
    last_reviewed: '2026-07-01T00:00:00.000Z',
    review_status: 'legal_reviewed',
    confidence_level: 'high',
    ...overrides,
  };
}

describe('Rewrite corpus loader', () => {
  it('loads nine legacy rewrite templates as corpus entries', () => {
    const entries = loadRewriteCorpusEntries();
    expect(entries).toHaveLength(9);
    expect(entries.map((entry) => entry.rewrite_id).sort()).toEqual([
      'cite-evidence',
      'disclose-ai',
      'disclose-localization',
      'disclose-transformation',
      'disclose-urgency',
      'qualify-comparative',
      'qualify-efficacy',
      'qualify-performance',
      'remove-health-claim',
    ]);
  });

  it('maps benchmark_refs and case_refs into platform linkage', () => {
    const entry = normalizeRewriteCorpusEntry(sampleEntry());
    const linkage = rewriteEntryLinkage(entry);
    expect(linkage.benchmarks).toEqual(['AF-003']);
    expect(linkage.cases).toEqual([]);
    expect(linkage.skills).toContain('skill:comparative-claim-review');
  });

  it('skips skill linkage requirement for independent disclosure rewrites', () => {
    expect(requiresSkillLinkage(sampleEntry())).toBe(true);
    expect(
      requiresSkillLinkage(
        sampleEntry({
          rewrite_linkage_scope: 'independent',
          rewrite_independence_rationale: 'Standalone disclosure rewrite guidance.',
          linkage: { regulations: ['regulation:sg-scap-disclosure'], rules: ['demo-apac-sa-localization'] },
        }),
      ),
    ).toBe(false);
  });

  it('registers rewrite plugin on knowledge platform', () => {
    expect(listRegisteredCorpusTypes()).toContain('rewrite');
    expect(getCorpusPlugin('rewrite')?.corpus_type).toBe('rewrite');
  });

  it('loads rewrite strategy taxonomy', () => {
    const corpus = loadRewriteCorpus();
    expect(corpus.strategies.rewrite_strategy_types).toHaveLength(4);
  });
});

describe('Rewrite corpus structure validation', () => {
  it('rejects cite_evidence without expected_evidence_type', () => {
    expect(() =>
      normalizeRewriteCorpusEntry(
        sampleEntry({
          rewrite_strategy_type: 'cite_evidence',
          evidence_requirement: 'required',
          expected_evidence_type: 'none',
        }),
      ),
    ).toThrow();
  });
});
