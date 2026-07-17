import type { EvidenceAiJudgment } from '@aairp/shared-kernel';

export type EvidenceJudgmentResponsePayload = EvidenceAiJudgment & {
  prompt_pack_version?: string;
};

function candidateJsonStrings(content: string): string[] {
  const trimmed = content.trim();
  const candidates = [trimmed];
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());
  const braceStart = trimmed.indexOf('{');
  const braceEnd = trimmed.lastIndexOf('}');
  if (braceStart >= 0 && braceEnd > braceStart) {
    candidates.push(trimmed.slice(braceStart, braceEnd + 1));
  }
  return [...new Set(candidates)];
}

function isRelevance(value: unknown): value is EvidenceAiJudgment['relevance'] {
  return value === 'strong' || value === 'partial' || value === 'none';
}

function isSufficiency(value: unknown): value is EvidenceAiJudgment['sufficiency'] {
  return value === 'sufficient' || value === 'insufficient';
}

export function parseEvidenceJudgmentResponse(content: string): EvidenceJudgmentResponsePayload {
  for (const candidate of candidateJsonStrings(content)) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (!isRelevance(parsed.relevance) || !isSufficiency(parsed.sufficiency)) continue;
      return {
        relevance: parsed.relevance,
        relevance_reasoning: String(parsed.relevance_reasoning ?? ''),
        sufficiency: parsed.sufficiency,
        sufficiency_reasoning: String(parsed.sufficiency_reasoning ?? ''),
        extracted_key_facts: String(parsed.extracted_key_facts ?? ''),
        judged_at: new Date().toISOString(),
        prompt_pack_version:
          typeof parsed.prompt_pack_version === 'string' ? parsed.prompt_pack_version : undefined,
      };
    } catch {
      // try next
    }
  }
  const preview = content.trim().replace(/\s+/g, ' ').slice(0, 240);
  throw new Error(`invalid evidence judgment LLM response (preview: ${preview || '(empty)'})`);
}
