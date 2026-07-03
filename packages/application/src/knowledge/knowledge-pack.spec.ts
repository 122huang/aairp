import { describe, expect, it } from 'vitest';
import { assembleKnowledgePackDraft } from './knowledge-pack-assembler.js';
import { fingerprintBody } from './knowledge-pack-fingerprint.js';
import { validateKnowledgePack, validateSupersedesChain } from './knowledge-pack-validator.js';
import {
  assembleAndWriteDraft,
  listReleasedPackIds,
  releaseKnowledgePack,
} from './knowledge-pack-release.js';
import {
  isKnowledgePackV2,
  loadKnowledgePackDraft,
  packVersion,
  packFingerprint,
  corpusFingerprints,
} from './knowledge-pack.js';
import { listRegisteredCorpusTypes } from './platform/knowledge-platform.js';

const NOW = new Date('2026-07-01T12:00:00.000Z');

describe('Knowledge Pack v2', () => {
  it('assembles pack with five corpus snapshots and no entry payloads', () => {
    const pack = assembleKnowledgePackDraft({ now: NOW });
    expect(isKnowledgePackV2(pack)).toBe(true);
    expect(pack.knowledge_pack_id).toMatch(/^kp-2026\.07\.\d+$/);
    expect(pack.knowledge_pack_id).toBe(pack.knowledge_pack_version);
    expect(pack.knowledge_pack_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(pack.corpora).sort()).toEqual(listRegisteredCorpusTypes().sort());
    expect(pack.corpora.regulation.entry_count).toBe(85);
    expect(pack.corpora.case.entry_count).toBe(28);
    expect(pack.dependency_graph.frozen_at).toBe(NOW.toISOString());
    expect(pack.runtime_components.legacy_references?.skill_modules).toBe(
      'docs/knowledge/skill-modules.json',
    );
    expect(pack.evaluation_linkage.regression_baseline_ref).toBeTruthy();
    expect('case_library' in pack).toBe(false);
    expect(JSON.stringify(pack)).not.toContain('"text":');
  });

  it('validates draft pack with zero errors (warnings allowed)', () => {
    const pack = assembleKnowledgePackDraft({ now: NOW });
    const result = validateKnowledgePack(pack, { now: NOW });
    expect(result.error_count).toBe(0);
    expect(result.passed).toBe(true);
  });

  it('computes stable fingerprint from corpus metadata only', () => {
    const pack = assembleKnowledgePackDraft({ now: NOW });
    expect(pack.knowledge_pack_fingerprint).toBe(
      fingerprintBody({
        ...pack,
        knowledge_pack_fingerprint: '',
      } as typeof pack),
    );
  });

  it('writes draft without releasing', () => {
    const pack = assembleAndWriteDraft({ now: NOW });
    const loaded = loadKnowledgePackDraft();
    expect(loaded?.knowledge_pack_id).toBe(pack.knowledge_pack_id);
    expect(loaded?.release_status).toBe('draft');
  });

  it('releases immutable pack via manual CLI flow', () => {
    const released = releaseKnowledgePack({
      released_by: 'test@aairp',
      now: NOW,
      draft: assembleKnowledgePackDraft({ now: NOW, release_status: 'validated' }),
    });
    expect(released.release_status).toBe('released');
    expect(released.released_by).toBe('test@aairp');
    expect(listReleasedPackIds()).toContain(released.knowledge_pack_id);

    expect(() =>
      releaseKnowledgePack({
        released_by: 'test@aairp',
        now: NOW,
        draft: released,
      }),
    ).toThrow(/already exists|immutable|cannot be modified/i);
  });

  it('exposes version helpers for eval consumers', () => {
    const pack = assembleKnowledgePackDraft({ now: NOW });
    expect(packVersion(pack)).toBe(pack.knowledge_pack_id);
    expect(packFingerprint(pack)).toBe(pack.knowledge_pack_fingerprint);
    const fingerprints = corpusFingerprints(pack);
    expect(fingerprints?.regulation).toBe(pack.corpora.regulation.fingerprint);
  });

  it('rejects circular supersedes chain', () => {
    const pack = assembleKnowledgePackDraft({ now: NOW, supersedes: 'kp-2026.06.1' });
    const issues = validateSupersedesChain(pack);
    expect(issues.some((issue) => issue.code === 'supersedes_unreleased')).toBe(true);
  });
});
