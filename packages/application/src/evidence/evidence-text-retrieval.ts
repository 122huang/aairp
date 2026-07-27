export const EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT = 12_000;

export type EvidenceTextPromptWindow = {
  text_for_prompt: string;
  full_len: number;
  prompt_len: number;
  truncated: boolean;
  limit: number;
};

export const EVIDENCE_CHUNK_MAX_SIZE = 1500;
export const EVIDENCE_CHUNK_OVERLAP = 200;
export const EVIDENCE_CHUNK_SEPARATOR = '\n\n[…]\n\n';

export function tokenizeForEvidenceRetrieval(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}%.-]+/gu, ' ');
  return normalized.split(/\s+/).filter((token) => token.length >= 2 || /^\d/.test(token));
}

export function chunkEvidenceText(
  text: string,
  maxSize = EVIDENCE_CHUNK_MAX_SIZE,
): Array<{ text: string; start: number; index: number }> {
  const chunks: Array<{ text: string; start: number; index: number }> = [];
  const paragraphs = text.split(/\n\s*\n/);
  let searchFrom = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      searchFrom += para.length + 2;
      continue;
    }

    const start = text.indexOf(trimmed, searchFrom);
    const baseStart = start >= 0 ? start : searchFrom;

    if (trimmed.length <= maxSize) {
      chunks.push({ text: trimmed, start: baseStart, index: chunks.length });
    } else {
      let offset = 0;
      while (offset < trimmed.length) {
        const slice = trimmed.slice(offset, offset + maxSize);
        chunks.push({ text: slice, start: baseStart + offset, index: chunks.length });
        if (offset + maxSize >= trimmed.length) break;
        offset += maxSize - EVIDENCE_CHUNK_OVERLAP;
      }
    }

    searchFrom = baseStart + trimmed.length;
  }

  if (chunks.length === 0 && text.trim()) {
    chunks.push({ text: text.slice(0, maxSize), start: 0, index: 0 });
  }

  return chunks;
}

export function scoreEvidenceChunk(
  chunk: string,
  claimAnchorText: string,
  queryTokens: string[],
): number {
  const lower = chunk.toLowerCase();
  const claim = claimAnchorText.trim().toLowerCase();
  let score = 0;

  if (claim.length >= 3 && lower.includes(claim)) {
    score += 100;
  }

  const chunkTokens = new Set(tokenizeForEvidenceRetrieval(chunk));
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) score += 5;
  }

  for (const num of claimAnchorText.match(/\d+(?:\.\d+)?/g) ?? []) {
    if (lower.includes(num)) score += 15;
  }

  if (/\d/.test(claimAnchorText)) {
    if (/\b(method|methodology|test|实测|测试|245\s*g|reference|÷|\/)\b/i.test(chunk)) {
      score += 8;
    }
  }

  return score;
}

/**
 * Step-2: select evidence chunks most relevant to claim_anchor before the 12k prompt cap.
 * Falls back to prefix slice only when no chunk scores above zero.
 */
export function selectEvidenceTextForPrompt(
  evidenceText: string,
  claimAnchorText: string,
  limit = EVIDENCE_JUDGMENT_PROMPT_TEXT_LIMIT,
): EvidenceTextPromptWindow {
  const full_len = evidenceText.length;
  if (full_len <= limit) {
    return {
      text_for_prompt: evidenceText,
      full_len,
      prompt_len: full_len,
      truncated: false,
      limit,
    };
  }

  const queryTokens = tokenizeForEvidenceRetrieval(claimAnchorText);
  const chunks = chunkEvidenceText(evidenceText);
  const scored = chunks.map((chunk) => ({
    ...chunk,
    score: scoreEvidenceChunk(chunk.text, claimAnchorText, queryTokens),
  }));

  const ranked = [...scored].sort((a, b) => b.score - a.score || a.index - b.index);
  const selected: typeof scored = [];
  let usedLen = 0;

  for (const item of ranked) {
    if (item.score <= 0 && selected.length > 0) continue;

    const sepLen = selected.length > 0 ? EVIDENCE_CHUNK_SEPARATOR.length : 0;
    const addLen = sepLen + item.text.length;
    if (usedLen + addLen <= limit) {
      selected.push(item);
      usedLen += addLen;
      continue;
    }

    const remaining = limit - usedLen - sepLen;
    if (remaining > 200 && item.score > 0) {
      selected.push({ ...item, text: item.text.slice(0, remaining) });
      usedLen = limit;
    }
    if (usedLen >= limit) break;
  }

  if (selected.length === 0) {
    const text_for_prompt = evidenceText.slice(0, limit);
    return {
      text_for_prompt,
      full_len,
      prompt_len: text_for_prompt.length,
      truncated: true,
      limit,
    };
  }

  selected.sort((a, b) => a.index - b.index);
  const text_for_prompt = selected.map((item) => item.text).join(EVIDENCE_CHUNK_SEPARATOR);

  return {
    text_for_prompt,
    full_len,
    prompt_len: text_for_prompt.length,
    truncated: true,
    limit,
  };
}
