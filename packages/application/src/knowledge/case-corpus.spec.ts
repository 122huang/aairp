import { describe, expect, it } from 'vitest';
import {
  loadCaseCorpus,
  loadCaseCorpusEntries,
  normalizeCaseCorpusEntry,
  verificationRank,
  type CaseCorpusEntry,
} from './case-corpus.js';
import { caseEntryLinkage } from './corpus/case-entry.adapter.js';
import { getCorpusPlugin, listRegisteredCorpusTypes } from './platform/knowledge-platform.js';
import { validateCaseCorpus } from './case-corpus-validator.js';

function sampleEntry(overrides: Partial<CaseCorpusEntry> = {}): CaseCorpusEntry {
  return {
    knowledge_id: 'case:test-case',
    corpus_type: 'case',
    case_id: 'test-case',
    case_purpose: 'Validation knowledge for benchmark test-case — health claim review scenario.',
    case_status: 'verified',
    case_version: '1.0.0',
    verification_status: 'human_verified',
    summary: 'Validates health claim scenario; expected REJECT with REMOVE action for cure language.',
    review_guidance:
      'TRIGGER: Benchmark case test-case. ACTION: Compare eval output to case_result. CHECK: decision, skill, rewrite. ESCALATE IF: regression.',
    scenario_spec: {
      claim_cluster: 'health-claim',
      claim_types: ['health-claim'],
      countries: ['SG'],
      benchmark_ref: 'sg-health-reject-cure',
    },
    ground_truth_spec: {
      expected_decision: 'REJECT',
      expected_action: 'REMOVE',
      evidence_validation: {
        evidence_id: 'evidence:health-claim-substantiation',
        expected_outcome: 'reject_insufficient_substantiation',
      },
    },
    case_result: {
      decision_outcome: 'REJECT',
      risk_level: 'HIGH',
      matched_skill: 'skill:health-claim-review',
      applied_rewrite: 'rewrite:remove-health-claim',
      evidence_result: 'reject_insufficient_substantiation',
    },
    benchmark_ref: 'sg-health-reject-cure',
    linkage: {
      regulations: ['regulation:sg-hsa-supplement-health-claims'],
      rules: ['demo-sg-health-forbidden-claim'],
      skills: ['skill:health-claim-review'],
      rewrites: ['rewrite:remove-health-claim'],
      evidence: ['evidence:health-claim-substantiation'],
    },
    owner: 'knowledge-eng@aairp',
    owner_type: 'knowledge_eng',
    last_reviewed: '2026-07-01T00:00:00.000Z',
    review_status: 'legal_reviewed',
    confidence_level: 'medium',
    ...overrides,
  };
}

describe('Case corpus loader', () => {
  it('loads twenty-eight pilot case entries', () => {
    const entries = loadCaseCorpusEntries();
    expect(entries).toHaveLength(28);
  });

  it('maps benchmark_ref into platform linkage', () => {
    const entry = normalizeCaseCorpusEntry(sampleEntry());
    const linkage = caseEntryLinkage(entry);
    expect(linkage.benchmarks).toEqual(['sg-health-reject-cure']);
    expect(linkage.skills).toContain('skill:health-claim-review');
  });

  it('requires human_verified for verified case_status', () => {
    expect(() =>
      normalizeCaseCorpusEntry(
        sampleEntry({
          verification_status: 'unverified',
        }),
      ),
    ).toThrow(/verification_status >= human_verified/);
    expect(verificationRank('human_verified')).toBeGreaterThan(verificationRank('unverified'));
  });

  it('registers case corpus plugin on knowledge platform', () => {
    expect(listRegisteredCorpusTypes()).toContain('case');
    expect(getCorpusPlugin('case')?.corpus_type).toBe('case');
  });

  it('validates pilot corpus with zero errors', () => {
    const result = validateCaseCorpus({ now: new Date('2026-07-01T00:00:00.000Z') });
    expect(result.entry_count).toBe(28);
    expect(result.error_count).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('loads taxonomy with case corpus bundle', () => {
    const bundle = loadCaseCorpus();
    expect(bundle.taxonomy.claim_clusters.length).toBeGreaterThan(0);
    expect(bundle.entries.length).toBe(28);
  });
});
