export type OpenRiskFindingPayload = {
  risk_type: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  suggested_action: string;
  confidence: number;
  evidence_spans?: Array<{
    field: string;
    start: number;
    end: number;
    text: string;
  }>;
  related_modules_checked?: string[];
  cited_case_ids?: string[];
  cited_rule_refs?: string[];
};

export type OpenRiskResponsePayload = {
  prompt_pack_version?: string;
  findings: OpenRiskFindingPayload[];
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

export function parseOpenRiskResponseContent(content: string): OpenRiskResponsePayload {
  for (const candidate of candidateJsonStrings(content)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) {
        return { findings: parsed as OpenRiskFindingPayload[] };
      }
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.findings)) {
          return obj as OpenRiskResponsePayload;
        }
        // Some providers return a single finding object; wrap it.
        if (typeof obj.risk_type === 'string') {
          return { findings: [obj as OpenRiskFindingPayload] };
        }
      }
    } catch {
      // try next candidate
    }
  }

  const preview = content.trim().replace(/\s+/g, ' ').slice(0, 240);
  throw new Error(
    `invalid open risk LLM response: findings array required (preview: ${preview || '(empty)'})`,
  );
}

/** @deprecated Use parseOpenRiskResponseContent */
export const parseOpenRiskStubResponse = parseOpenRiskResponseContent;
