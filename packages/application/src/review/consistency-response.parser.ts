export type ConsistencyLlmFindingPayload = {
  field: string;
  conflict: string;
  slices_involved: string[];
  values: string[];
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence?: number;
};

export type ConsistencyLlmResponsePayload = {
  prompt_pack_version?: string;
  findings: ConsistencyLlmFindingPayload[];
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

export function parseConsistencyResponseContent(content: string): ConsistencyLlmResponsePayload {
  for (const candidate of candidateJsonStrings(content)) {
    try {
      const parsed = JSON.parse(candidate) as ConsistencyLlmResponsePayload;
      if (parsed && Array.isArray(parsed.findings)) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error('invalid consistency LLM response: findings array required');
}
