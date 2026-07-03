import { describe, expect, it } from 'vitest';
import {
  loadEvidenceCorpus,
  loadEvidenceCorpusEntries,
  normalizeEvidenceCorpusEntry,
  requiresDocumentRefSpec,
  resolveExpectedEvidenceType,
  type EvidenceCorpusEntry,
} from './evidence-corpus.js';
import { evidenceEntryLinkage } from './corpus/evidence-entry.adapter.js';
import { getCorpusPlugin, listRegisteredCorpusTypes } from './platform/knowledge-platform.js';

function sampleEntry(overrides: Partial<EvidenceCorpusEntry> = {}): EvidenceCorpusEntry {
  return {
    knowledge_id: 'evidence:test-evidence',
    corpus_type: 'evidence',
    evidence_id: 'test-evidence',
    evidence_purpose:
      'Define substantiation requirements for test certification marks in advertising review.',
    evidence_status: 'production',
    evidence_version: '1.0.0',
    evidence_type_key: 'certification',
    requirement_scope: 'certification-mark',
    summary: 'Test certification marks require verifiable certificate records for advertised product scope.',
    review_guidance:
      'TRIGGER: Certification mark in ad. ACTION: Request certificate. CHECK: Scope and expiry. ESCALATE IF: cannot verify.',
    validation_criteria: {
      checks: ['Confirm issuer is recognized', 'Verify certificate scope covers product'],
      reject_if: ['Certificate expired'],
    },
    applicability: {
      countries: ['SG'],
      claim_types: ['certification-claim'],
      modalities: ['text'],
    },
    requirement_level: 'required',
    document_ref_spec: {
      ref_kind: 'certification_record',
      id_format: '{issuer}-{cert_number}',
      storage_system: 'KOS',
      example: 'TEST-001',
    },
    linkage: {
      regulations: ['regulation:sg-hsa-certification-marks'],
      rules: ['demo-apac-sa-certification-evidence'],
      skills: ['skill:certification-claim-review'],
      rewrites: ['rewrite:cite-evidence'],
    },
    resolves_expected_evidence_types: ['certification'],
    evidence_purpose_tags: ['certification-mark'],
    benchmark_refs: ['AF-009'],
    case_refs: [],
    owner: 'compliance-apac@aairp',
    owner_type: 'compliance',
    last_reviewed: '2026-07-01T00:00:00.000Z',
    review_status: 'legal_reviewed',
    confidence_level: 'high',
    ...overrides,
  };
}

describe('Evidence corpus loader', () => {
  it('loads twenty pilot evidence entries', () => {
    const entries = loadEvidenceCorpusEntries();
    expect(entries).toHaveLength(20);
  });

  it('maps benchmark_refs into platform linkage', () => {
    const entry = normalizeEvidenceCorpusEntry(sampleEntry());
    const linkage = evidenceEntryLinkage(entry);
    expect(linkage.benchmarks).toEqual(['AF-009']);
    expect(linkage.skills).toContain('skill:certification-claim-review');
    expect(linkage.rewrites).toContain('rewrite:cite-evidence');
  });

  it('requires document_ref_spec for document-backed types', () => {
    expect(requiresDocumentRefSpec(sampleEntry())).toBe(true);
    expect(() =>
      normalizeEvidenceCorpusEntry(
        sampleEntry({
          document_ref_spec: undefined,
        }),
      ),
    ).toThrow();
  });

  it('registers evidence plugin on knowledge platform', () => {
    expect(listRegisteredCorpusTypes()).toContain('evidence');
    expect(getCorpusPlugin('evidence')?.corpus_type).toBe('evidence');
  });

  it('resolves rewrite expected_evidence_type via purpose tags', () => {
    const corpus = loadEvidenceCorpus();
    const resolved = resolveExpectedEvidenceType('certification', corpus.entries, corpus.types);
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.some((entry) => entry.evidence_purpose_tags.includes('certification-mark'))).toBe(
      true,
    );
  });
});
