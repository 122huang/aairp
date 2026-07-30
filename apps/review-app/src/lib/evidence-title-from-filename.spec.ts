import { describe, expect, it } from 'vitest';
import { evidenceTitleFromFilename } from './evidence-title-from-filename';

describe('evidenceTitleFromFilename', () => {
  it('strips pdf extension', () => {
    expect(evidenceTitleFromFilename('CLM-012884-capacity.pdf')).toBe('CLM-012884-capacity');
  });

  it('strips path segments', () => {
    expect(evidenceTitleFromFilename('C:\\docs\\report.txt')).toBe('report');
  });

  it('keeps basename when extension-only', () => {
    expect(evidenceTitleFromFilename('.pdf')).toBe('.pdf');
  });
});
