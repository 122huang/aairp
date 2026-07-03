import { describe, expect, it } from 'vitest';
import {
  loadSkillCorpus,
  loadSkillCorpusEntries,
  normalizeSkillCorpusEntry,
  requiresRegulationLinkage,
  type SkillCorpusEntry,
} from './skill-corpus.js';
import { skillEntryLinkage } from './corpus/skill-entry.adapter.js';
import { listRegisteredCorpusTypes, getCorpusPlugin } from './platform/knowledge-platform.js';

const NOW = new Date('2026-06-29T12:00:00.000Z');

function sampleEntry(overrides: Partial<SkillCorpusEntry> = {}): SkillCorpusEntry {
  return {
    knowledge_id: 'skill:test-skill',
    corpus_type: 'skill',
    skill_id: 'test-skill',
    skill_purpose: 'Review test claims for substantiation and permitted wording scope in ads.',
    skill_status: 'production',
    skill_version: '1.0.0',
    summary: 'Test skill summary with enough characters for governance scoring requirements.',
    review_guidance:
      'TRIGGER: Test claims. ACTION: Inspect copy. CHECK: Wording. ESCALATE IF: binding rule conflict.',
    input_definition: {
      modalities: ['text'],
      countries: ['SG'],
      categories: ['sa.*'],
      claim_types: ['health-claim'],
    },
    detection_patterns: [
      {
        pattern_id: 'test-pattern',
        description: 'Detect test claim signals in ad copy.',
        playbook_pattern_id: 'sa-health-implication',
      },
    ],
    skill_behavior: {
      rewrite_strategy: 'qualify',
      checkpoint_actions: ['Check substantiation', 'Verify product category'],
    },
    output_schema: {
      fields: ['matched_patterns', 'matched_rules', 'rationale'],
    },
    linkage: {
      regulations: ['regulation:sg-hsa-supplement-health-claims'],
      rules: ['demo-apac-sa-health-claim-blocker'],
      benchmarks: ['PC-008'],
    },
    owner: 'legal-apac@aairp',
    owner_type: 'legal',
    last_reviewed: '2026-06-01T00:00:00.000Z',
    review_status: 'legal_reviewed',
    confidence_level: 'high',
    evidence_requirement: 'required',
    ...overrides,
  };
}

describe('Skill corpus loader', () => {
  it('loads five advertising review skills', () => {
    const entries = loadSkillCorpusEntries();
    expect(entries).toHaveLength(5);
    expect(entries.map((entry) => entry.skill_id).sort()).toEqual([
      'certification-claim-review',
      'comparative-claim-review',
      'health-claim-review',
      'performance-claim-review',
      'superlative-claim-review',
    ]);
  });

  it('normalizes knowledge_id and linkage prefixes', () => {
    const entry = normalizeSkillCorpusEntry(sampleEntry());
    expect(entry.knowledge_id).toBe('skill:test-skill');
    expect(skillEntryLinkage(entry).regulations).toContain('regulation:sg-hsa-supplement-health-claims');
  });

  it('requires regulation linkage for active skills', () => {
    expect(requiresRegulationLinkage(sampleEntry({ skill_status: 'production' }))).toBe(true);
    expect(requiresRegulationLinkage(sampleEntry({ skill_status: 'draft' }))).toBe(false);
    expect(
      requiresRegulationLinkage(
        sampleEntry({ skill_status: 'production', regulation_scope: 'independent' }),
      ),
    ).toBe(false);
  });

  it('registers skill plugin on knowledge platform', () => {
    expect(listRegisteredCorpusTypes()).toContain('skill');
    expect(getCorpusPlugin('skill')?.corpus_type).toBe('skill');
  });

  it('loads claim types taxonomy', () => {
    const corpus = loadSkillCorpus();
    expect(corpus.claim_types.claim_types).toHaveLength(5);
  });
});

describe('Skill corpus structure validation', () => {
  it('rejects active skill without regulation linkage', () => {
    expect(() =>
      normalizeSkillCorpusEntry(
        sampleEntry({
          linkage: { rules: ['demo-apac-sa-health-claim-blocker'] },
        }),
      ),
    ).not.toThrow();

    const plugin = getCorpusPlugin('skill')!;
    const result = plugin.validate(
      [
        sampleEntry({
          linkage: { rules: ['demo-apac-sa-health-claim-blocker'] },
        }),
      ],
      { now: NOW, knownRuleIds: plugin.knownRuleIds?.() },
    );
    expect(result.error_count).toBeGreaterThan(0);
    expect(result.issues.some((issue) => issue.code === 'missing_regulation_linkage')).toBe(true);
  });
});
