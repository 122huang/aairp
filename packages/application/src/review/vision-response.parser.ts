export type VisionEvidenceSpanPayload = {
  field: string;
  slice_index?: number;
  region_description?: string;
  start?: number;
  end?: number;
  text?: string;
};

export type VisionFindingPayload = {
  risk_type: string;
  description: string;
  severity: 'BLOCKER' | 'HIGH' | 'MEDIUM' | 'LOW';
  suggested_action: string;
  confidence: number;
  scan_dimension?: string;
  evidence_spans?: VisionEvidenceSpanPayload[];
  related_modules_checked?: string[];
  cited_rule_refs?: string[];
};

export type VisionResponsePayload = {
  prompt_pack_version?: string;
  extracted_text?: string[];
  findings: VisionFindingPayload[];
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

export function parseVisionResponseContent(content: string): VisionResponsePayload {
  for (const candidate of candidateJsonStrings(content)) {
    try {
      const parsed = JSON.parse(candidate) as VisionResponsePayload;
      if (parsed && Array.isArray(parsed.findings)) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error('invalid vision LLM response: findings array required');
}
