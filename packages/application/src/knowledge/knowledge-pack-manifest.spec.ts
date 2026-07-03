import { describe, expect, it } from 'vitest';
import { assembleAndWriteDraft, validateAndMarkDraft } from './knowledge-pack-manifest.js';
import { isKnowledgePackV2 } from './knowledge-pack.js';

describe('Knowledge Pack Manifest facade', () => {
  it('assembles v2 draft with monotonic pack id and fingerprint', () => {
    const pack = assembleAndWriteDraft({ now: new Date('2026-07-01T12:00:00.000Z') });
    expect(isKnowledgePackV2(pack)).toBe(true);
    expect(pack.knowledge_pack_id).toMatch(/^kp-\d{4}\.\d{2}\.\d+$/);
    expect(pack.knowledge_pack_fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(pack.corpora.regulation.entry_count).toBe(85);
    expect(pack.corpora.skill.entry_count).toBe(5);
  });

  it('validates draft via legacy pack-manifest command path', () => {
    const { validation } = validateAndMarkDraft({ now: new Date('2026-07-01T12:00:00.000Z') });
    expect(validation.error_count).toBe(0);
  });
});
