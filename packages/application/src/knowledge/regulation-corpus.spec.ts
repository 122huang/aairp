import { describe, expect, it } from 'vitest';
import {
  assertKnowledgeIdMatches,
  buildKnowledgeId,
  parseKnowledgeId,
} from './knowledge-corpus.js';
import {
  loadRegulationCategories,
  loadRegulationCorpus,
  loadRegulationCorpusEntries,
  loadRegulationCountries,
  normalizeRegulationEntry,
  REGULATION_CORPUS_COUNTRY_CODES,
} from './regulation-corpus.js';

describe('Knowledge Corpus identifiers (E1)', () => {
  it('builds and parses knowledge_id', () => {
    const id = buildKnowledgeId('regulation', 'sg-hpa-s7-prohibited-claims');
    expect(id).toBe('regulation:sg-hpa-s7-prohibited-claims');
    expect(parseKnowledgeId(id)).toEqual({
      corpus_type: 'regulation',
      stable_key: 'sg-hpa-s7-prohibited-claims',
    });
  });

  it('rejects invalid knowledge_id format', () => {
    expect(parseKnowledgeId('sg-hpa-s7')).toBeNull();
    expect(parseKnowledgeId('regulation:Bad-Id')).toBeNull();
  });

  it('asserts knowledge_id matches regulation_id', () => {
    expect(() =>
      assertKnowledgeIdMatches(
        'regulation:sg-hpa-s7-prohibited-claims',
        'regulation',
        'sg-hpa-s7-prohibited-claims',
      ),
    ).not.toThrow();
    expect(() =>
      assertKnowledgeIdMatches(
        'regulation:other-id',
        'regulation',
        'sg-hpa-s7-prohibited-claims',
      ),
    ).toThrow(/stable key mismatch/);
  });
});

describe('Regulation Corpus loader (E1)', () => {
  const categories = loadRegulationCategories();
  const countries = loadRegulationCountries();
  const corpus = loadRegulationCorpus();

  it('loads 12 regulation categories', () => {
    expect(categories.categories).toHaveLength(12);
    const names = new Set(categories.categories.map((category) => category.name));
    expect(names.has('Medical Claims')).toBe(true);
    expect(names.has('Mandatory Disclaimers')).toBe(true);
  });

  it('loads 9 country definitions', () => {
    expect(countries.countries).toHaveLength(9);
    expect(countries.countries.map((country) => country.country_code).sort()).toEqual(
      [...REGULATION_CORPUS_COUNTRY_CODES].sort(),
    );
  });

  it('loads E2 corpus entries (85 total across 9 countries)', () => {
    const entries = loadRegulationCorpusEntries();
    expect(entries.length).toBe(85);
    const ids = new Set(entries.map((entry) => entry.regulation_id));
    expect(ids.has('sg-hpa-s7-prohibited-claims')).toBe(true);
    expect(ids.has('sg-asasa-substantiation')).toBe(true);
    expect(ids.has('sg-scap-disclosure')).toBe(true);
    expect(corpus.by_country.SG.length).toBe(16);
    expect(corpus.by_country.MY.length).toBe(10);
    expect(corpus.by_country.AU.length).toBe(9);
    expect(corpus.by_country.VN.length).toBe(5);
    expect(corpus.by_country.PH.length).toBe(5);
  });

  it('normalizes entries with valid envelope and evidence prefix', () => {
    const entry = corpus.entries.find((item) => item.regulation_id === 'sg-scap-disclosure');
    expect(entry).toBeDefined();
    expect(entry!.corpus_type).toBe('regulation');
    expect(entry!.knowledge_id).toBe('regulation:sg-scap-disclosure');
    expect(entry!.related_evidence_ids).toEqual([]);
  });

  it('rejects invalid related_evidence_ids prefix', () => {
    expect(() =>
      normalizeRegulationEntry({
        knowledge_id: 'regulation:test-reg',
        corpus_type: 'regulation',
        regulation_id: 'test-reg',
        country: 'SG',
        authority: 'HSA',
        regulation_name: 'Test',
        citation: 's.1',
        effective_date: '2020-01-01',
        category: 'Health Claims',
        mandatory: true,
        risk_level: 'LOW',
        summary: 'summary',
        review_guidance: 'guidance',
        related_rule_ids: [],
        pending_rule_ids: [],
        related_evidence_ids: ['bad-id'],
        owner: 'legal@aairp',
        owner_type: 'legal',
        last_reviewed: '2026-01-01T00:00:00.000Z',
        review_status: 'draft',
      }),
    ).toThrow(/evidence:/);
  });

  it('indexes entries by country', () => {
    expect(corpus.by_country.SG.length).toBe(16);
    for (const code of REGULATION_CORPUS_COUNTRY_CODES) {
      expect(corpus.by_country[code].length).toBeGreaterThan(0);
    }
  });
});
