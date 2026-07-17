export type EvidenceTextExtractionResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'unreadable' | 'unsupported_type' };

const MIN_EXTRACTED_CHARS = 20;

/** v1: plain text + standard PDF text layer only (no OCR / vision). */
export function extractEvidenceText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): EvidenceTextExtractionResult {
  const lowerName = filename.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (
    mime.startsWith('text/') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.csv')
  ) {
    const text = buffer.toString('utf8').trim();
    return text.length >= MIN_EXTRACTED_CHARS
      ? { ok: true, text }
      : { ok: false, reason: 'unreadable' };
  }

  if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    const text = extractPdfTextLayer(buffer);
    return text.length >= MIN_EXTRACTED_CHARS
      ? { ok: true, text }
      : { ok: false, reason: 'unreadable' };
  }

  // Best-effort UTF-8 for unknown types
  const fallback = buffer.toString('utf8').replace(/[\x00-\x08\x0e-\x1f]/g, ' ').trim();
  if (fallback.length >= MIN_EXTRACTED_CHARS && /[\u4e00-\u9fffA-Za-z0-9]/.test(fallback)) {
    return { ok: true, text: fallback };
  }

  return { ok: false, reason: 'unsupported_type' };
}

/** Extract literal strings from PDF content streams (text layer only). */
function extractPdfTextLayer(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const chunks: string[] = [];

  const parenRegex = /\((?:\\.|[^\\()])*\)/g;
  let match: RegExpExecArray | null;
  while ((match = parenRegex.exec(raw)) !== null) {
    const decoded = decodePdfLiteral(match[0]);
    if (decoded.trim().length >= 2) chunks.push(decoded.trim());
  }

  const hexRegex = /<([0-9A-Fa-f\s]+)>/g;
  while ((match = hexRegex.exec(raw)) !== null) {
    const hex = match[1]!.replace(/\s+/g, '');
    if (hex.length >= 4 && hex.length % 2 === 0) {
      let decoded = '';
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.slice(i, i + 2), 16);
        if (code >= 32 && code <= 126) decoded += String.fromCharCode(code);
      }
      if (decoded.trim().length >= 2) chunks.push(decoded.trim());
    }
  }

  return [...new Set(chunks)].join('\n').replace(/\s+/g, ' ').trim();
}

function decodePdfLiteral(token: string): string {
  const inner = token.slice(1, -1);
  return inner
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}
