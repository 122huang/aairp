import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_POOL_MAX_FILES,
  EvidencePoolValidationError,
  extractEvidenceFiles,
} from './evidence-pool.js';

function file(partial: Record<string, unknown> = {}) {
  return {
    filename: 'lab.pdf',
    mime_type: 'application/pdf',
    content_base64: 'dGVzdA==',
    ...partial,
  };
}

describe('extractEvidenceFiles', () => {
  it('returns empty when evidence_files is omitted', () => {
    expect(extractEvidenceFiles({ content: { text: 'ad' } })).toEqual([]);
    expect(extractEvidenceFiles({})).toEqual([]);
    expect(extractEvidenceFiles(null)).toEqual([]);
  });

  it('defaults source type to INTERNAL_TEST', () => {
    const [parsed] = extractEvidenceFiles({ evidence_files: [file()] });
    expect(parsed.evidence_source_type).toBe('INTERNAL_TEST');
    expect(parsed.filename).toBe('lab.pdf');
  });

  it('accepts PDF, TXT and MD with an explicit source type', () => {
    const parsed = extractEvidenceFiles({
      evidence_files: [
        file({ filename: 'a.pdf', evidence_source_type: 'THIRD_PARTY_LAB' }),
        file({ filename: 'notes.txt', mime_type: 'text/plain' }),
        file({ filename: 'memo.md', mime_type: '' }),
      ],
    });
    expect(parsed).toHaveLength(3);
    expect(parsed[0].evidence_source_type).toBe('THIRD_PARTY_LAB');
    expect(parsed[2].mime_type).toBe('text/markdown');
  });

  it('rejects images and other non-text evidence types', () => {
    expect(() =>
      extractEvidenceFiles({
        evidence_files: [file({ filename: 'hero.jpg', mime_type: 'image/jpeg' })],
      }),
    ).toThrow(EvidencePoolValidationError);
  });

  it('rejects more than the file cap', () => {
    const files = Array.from({ length: EVIDENCE_POOL_MAX_FILES + 1 }, (_, index) =>
      file({ filename: `f${index}.pdf` }),
    );
    expect(() => extractEvidenceFiles({ evidence_files: files })).toThrow(/最多上传/);
  });

  it('rejects oversized base64 payloads', () => {
    const oversized = 'A'.repeat(15 * 1024 * 1024);
    expect(() =>
      extractEvidenceFiles({
        evidence_files: [file({ content_base64: oversized })],
      }),
    ).toThrow(EvidencePoolValidationError);
  });
});
