export type RewriteLlmResponsePayload = {
  prompt_pack_version?: string;
  risk_type: string;
  rewrite_strategy: string;
  rewrite_template_id: string;
  original_span: string;
  suggested_text: string[];
  rationale: string;
  confidence: number;
};

function candidateJsonStrings(content: string): string[] {
  const trimmed = content.trim();
  const candidates = [trimmed];

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    candidates.push(fenceMatch[1].trim());
  }

  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) {
    candidates.push(trimmed.slice(braceStart, braceEnd + 1));
  }

  return [...new Set(candidates)];
}

function hasRewritePayloadShape(parsed: RewriteLlmResponsePayload): boolean {
  return (
    typeof parsed.risk_type === 'string' &&
    typeof parsed.rewrite_strategy === 'string' &&
    typeof parsed.rewrite_template_id === 'string' &&
    typeof parsed.original_span === 'string' &&
    Array.isArray(parsed.suggested_text) &&
    parsed.suggested_text.some((item) => typeof item === 'string' && item.trim().length > 0) &&
    typeof parsed.rationale === 'string' &&
    parsed.rationale.trim().length > 0 &&
    typeof parsed.confidence === 'number' &&
    Number.isFinite(parsed.confidence)
  );
}

export function normalizeRewriteResponsePayload(
  parsed: RewriteLlmResponsePayload,
): RewriteLlmResponsePayload {
  const suggested_text = parsed.suggested_text
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, 3)
    .map((item) => item.trim());

  return {
    ...parsed,
    suggested_text,
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
  };
}

function isValidRewritePayload(parsed: RewriteLlmResponsePayload): boolean {
  return (
    hasRewritePayloadShape(parsed) &&
    parsed.suggested_text.length >= 1 &&
    parsed.suggested_text.length <= 3 &&
    parsed.confidence >= 0 &&
    parsed.confidence <= 1
  );
}

export function parseRewriteResponseContent(content: string): RewriteLlmResponsePayload {
  for (const candidate of candidateJsonStrings(content)) {
    try {
      const parsed = JSON.parse(candidate) as RewriteLlmResponsePayload;
      if (parsed && hasRewritePayloadShape(parsed)) {
        const normalized = normalizeRewriteResponsePayload(parsed);
        if (isValidRewritePayload(normalized)) {
          return normalized;
        }
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error('invalid rewrite LLM response: suggested_text array (1–3 items) required');
}
