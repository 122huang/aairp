/**
 * Filter noisy OCR line segments (Tesseract hallucinations, low confidence, symbol junk).
 */

const NOISE_PATTERN = /^[\s.\-|_=+·…，。！？、:;'"\\\/\[\](){}<>~`@#$%^&*]+$/;

/** @typedef {{ text: string; x0?: number; y0?: number; x1?: number; y1?: number; confidence?: number; score?: number }} OcrSegment */

/**
 * @param {OcrSegment[]} segments
 * @param {{ minConfidence?: number; minScore?: number }} [options]
 */
export function filterOcrSegments(segments, options = {}) {
  const minConfidence = options.minConfidence ?? 62;
  const minScore = options.minScore ?? 0.62;
  const kept = [];
  let dropped = 0;

  for (const seg of segments) {
    const text = seg.text?.trim() ?? '';
    if (!text) {
      dropped += 1;
      continue;
    }

    if (seg.score != null && seg.score < minScore) {
      dropped += 1;
      continue;
    }
    if (seg.confidence != null && seg.confidence < minConfidence) {
      dropped += 1;
      continue;
    }

    if (isNoisySegment(text)) {
      dropped += 1;
      continue;
    }

    const cleaned = cleanCalloutSegmentText(text);
    kept.push(cleaned === text ? seg : { ...seg, text: cleaned });
  }

  const merged = mergePartialLineDuplicates(kept);
  return { segments: dedupeSegments(merged), dropped };
}

/** @param {string} text */
export function isNoisySegment(text) {
  if (text.length === 1 && !/[A-Za-z0-9]/.test(text)) return true;
  if (NOISE_PATTERN.test(text)) return true;
  if (/^[—–\-_|=+\\\/]{1,3}$/.test(text)) return true;

  if (text.length <= 10 && /(.)\1{2,}/u.test(text)) return true;

  if (isScatteredFragment(text)) return true;

  const letters = (text.match(/[A-Za-z0-9]/g) || []).length;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const meaningful = letters + cjk;

  if (meaningful / text.length < 0.3 && text.length < 16) return true;

  if (cjk > 0 && letters === 0 && cjk <= 3 && text.length <= 4) return true;

  const words = text.split(/\s+/).filter((w) => w.length > 1);
  const symbolRuns = (text.match(/[^\w\u4e00-\u9fff\s]{2,}/g) || []).length;
  if (words.length === 0 && symbolRuns >= 1 && text.length < 20) return true;

  return false;
}

/** 背景纹理上常见的「碎屑识别」：yL r 上、4 UN、人 7 */
function isScatteredFragment(text) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  if (tokens.length === 1) {
    const t = tokens[0];
    if (t.length <= 2 && !/^\d{3,}$/.test(t)) return true;
    return false;
  }

  const hasRealWord = tokens.some(
    (t) => t.length >= 4 || /^[A-Za-z]{3,}$/.test(t) || /[\u4e00-\u9fff]{2,}/.test(t),
  );
  if (hasRealWord) return false;

  const shortCount = tokens.filter((t) => t.length <= 2).length;
  if (shortCount >= 2 && shortCount / tokens.length >= 0.6) return true;

  return false;
}

/** @param {string} line */
export function cleanCalloutSegmentText(line) {
  let text = line.trim();
  const pipeIdx = text.indexOf('|');
  if (pipeIdx >= 0) {
    const after = text.slice(pipeIdx + 1).trim();
    if (!/^\d/.test(after) && !/\d+\s*kPa|\|\s*\d/i.test(after) && !/[A-Za-z]{3,}/.test(after)) {
      text = text.slice(0, pipeIdx).trim();
    }
  }
  return text
    .replace(/^[\d①②③④⑤⑥⑦⑧⑨⑩]+\.?\s*/u, '')
    .replace(/^mm\s+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** 同一行上「缺首尾」的短框 vs 完整框：保留更长、置信更高的一条 */
function mergePartialLineDuplicates(segments) {
  const yTolerance = 28;
  const sorted = [...segments].sort(
    (a, b) => (a.y0 ?? 0) - (b.y0 ?? 0) || (a.x0 ?? 0) - (b.x0 ?? 0),
  );
  const remove = new Set();

  for (let i = 0; i < sorted.length; i += 1) {
    if (remove.has(i)) continue;
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (remove.has(j)) continue;
      const dy = Math.abs((sorted[i].y0 ?? 0) - (sorted[j].y0 ?? 0));
      if (dy > yTolerance) {
        if ((sorted[j].y0 ?? 0) - (sorted[i].y0 ?? 0) > yTolerance) break;
        continue;
      }

      const drop = pickPartialDuplicateDrop(sorted[i], sorted[j]);
      if (drop === 'a') remove.add(i);
      else if (drop === 'b') remove.add(j);
    }
  }

  return sorted.filter((_, idx) => !remove.has(idx));
}

/** @returns {'a'|'b'|null} which segment to drop */
function pickPartialDuplicateDrop(a, b) {
  const ta = a.text.trim();
  const tb = b.text.trim();
  if (!ta || !tb) return null;

  const la = ta.toLowerCase();
  const lb = tb.toLowerCase();
  if (la === lb) return segmentQuality(b) > segmentQuality(a) ? 'a' : 'b';

  const coreA = alphaNumCore(ta);
  const coreB = alphaNumCore(tb);
  const minCore = 8;

  if (coreA.length >= minCore && coreB.length >= minCore) {
    if (coreB.includes(coreA) && coreA.length + 2 < coreB.length) return 'a';
    if (coreA.includes(coreB) && coreB.length + 2 < coreA.length) return 'b';
  }

  return null;
}

/** @param {OcrSegment} seg */
function segmentQuality(seg) {
  const conf = seg.confidence ?? (seg.score != null ? seg.score * 100 : 0);
  return seg.text.trim().length * 1000 + conf;
}

/** @param {string} text */
function alphaNumCore(text) {
  return text.replace(/^[-–—|]+\s*/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/** @param {OcrSegment[]} segments */
function dedupeSegments(segments) {
  const seen = new Set();
  const out = [];
  for (const seg of segments) {
    const key = `${seg.text.trim()}@${Math.round(seg.y0 ?? 0)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(seg);
  }
  return out;
}

/** @param {OcrSegment[]} segments */
export function segmentsToText(segments) {
  return segments
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {{ segments?: OcrSegment[]; ocr_text?: string; [key: string]: unknown }} res
 */
export function cleanOcrResult(res) {
  const rawSegments = res.segments ?? [];
  if (!rawSegments.length) {
    return { ...res, filter_dropped: 0 };
  }

  const { segments, dropped } = filterOcrSegments(rawSegments);
  const ocr_text = segmentsToText(segments) || String(res.ocr_text ?? '').trim();

  return {
    ...res,
    segments,
    ocr_text,
    ocr_draft: ocr_text,
    filter_dropped: dropped,
  };
}
