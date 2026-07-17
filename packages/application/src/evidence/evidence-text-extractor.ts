import { extractText, getDocumentProxy } from 'unpdf';

export type EvidenceTextExtractionResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'unreadable' | 'unsupported_type' };

const MIN_EXTRACTED_CHARS = 20;

/** Reject extractions that are mostly binary/control noise (old regex scraper failure mode). */
function looksLikeReadableText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MIN_EXTRACTED_CHARS) return false;
  const sample = trimmed.slice(0, 4000);
  let letters = 0;
  let controls = 0;
  for (const ch of sample) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x30 && code <= 0x39)
    ) {
      letters += 1;
    } else if (code < 0x09 || (code > 0x0d && code < 0x20) || code === 0xfffd) {
      controls += 1;
    }
  }
  if (controls / sample.length > 0.05) return false;
  if (letters / sample.length < 0.2) return false;
  return true;
}

async function extractPdfWithUnpdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join('\n') : String(result.text ?? '');
  return text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim();
}

/**
 * v1 evidence text extraction.
 * - Plain text: UTF-8 decode
 * - PDF: Mozilla pdf.js via `unpdf` (handles FlateDecode / ToUnicode) — NOT a raw-byte regex scrape
 * - No OCR / vision for image-only scans
 */
export async function extractEvidenceText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<EvidenceTextExtractionResult> {
  const lowerName = filename.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (
    mime.startsWith('text/') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.csv')
  ) {
    const text = buffer.toString('utf8').trim();
    return text.length >= MIN_EXTRACTED_CHARS && looksLikeReadableText(text)
      ? { ok: true, text }
      : { ok: false, reason: 'unreadable' };
  }

  if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    try {
      const text = await extractPdfWithUnpdf(buffer);
      if (!looksLikeReadableText(text)) {
        return { ok: false, reason: 'unreadable' };
      }
      return { ok: true, text };
    } catch {
      return { ok: false, reason: 'unreadable' };
    }
  }

  // Best-effort UTF-8 for unknown types
  const fallback = buffer.toString('utf8').replace(/[\x00-\x08\x0e-\x1f]/g, ' ').trim();
  if (looksLikeReadableText(fallback)) {
    return { ok: true, text: fallback };
  }

  return { ok: false, reason: 'unsupported_type' };
}
