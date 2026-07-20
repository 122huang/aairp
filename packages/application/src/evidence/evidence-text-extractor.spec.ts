import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { extractEvidenceText } from './evidence-text-extractor.js';

function buildPdfWithContentStream(streamBytes: Buffer, useFlate: boolean): Buffer {
  const filter = useFlate ? ' /Filter /FlateDecode' : '';
  const objs: Buffer[] = [
    Buffer.from('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n'),
    Buffer.from('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n'),
    Buffer.from(
      '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>endobj\n',
    ),
    Buffer.from('4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n'),
    Buffer.concat([
      Buffer.from(`5 0 obj<< /Length ${streamBytes.length}${filter} >>stream\n`),
      streamBytes,
      Buffer.from('\nendstream\nendobj\n'),
    ]),
  ];

  let body = Buffer.from('%PDF-1.4\n');
  const positions: number[] = [];
  for (const obj of objs) {
    positions.push(body.length);
    body = Buffer.concat([body, obj]);
  }
  const xrefStart = body.length;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (const pos of positions) {
    xref += `${String(pos).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.concat([body, Buffer.from(xref), Buffer.from(trailer)]);
}

describe('extractEvidenceText PDF', () => {
  it('extracts FlateDecode content streams (pdftotext-class PDFs)', async () => {
    const plain = Buffer.from(
      'BT /F1 12 Tf 72 720 Td (CLM-012884 capacity: 1.96-2.45 kg / 245g = 8-10 people) Tj ET',
      'latin1',
    );
    const pdf = buildPdfWithContentStream(deflateSync(plain), true);
    const result = await extractEvidenceText(pdf, 'application/pdf', 'clm.pdf');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('CLM-012884');
    expect(result.text).toContain('8-10 people');
    expect(result.text).toContain('245g');
  });

  it('extracts uncompressed literal text streams', async () => {
    const plain = Buffer.from(
      'BT /F1 12 Tf 100 700 Td (Cook for up to 8-10 people. FDA 245g reference.) Tj ET',
      'latin1',
    );
    const pdf = buildPdfWithContentStream(plain, false);
    const result = await extractEvidenceText(pdf, 'application/pdf', 'memo.pdf');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('8-10 people');
  });

  it('still reads plain text uploads', async () => {
    const result = await extractEvidenceText(
      Buffer.from('Measured total weight 1.96-2.45 kg divided by FDA 245g yields 8-10 people.', 'utf8'),
      'text/plain',
      'memo.txt',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toContain('245g');
  });
});
