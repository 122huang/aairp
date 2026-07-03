export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type EvidenceRequirement = 'none' | 'recommended' | 'required';

const CONFIDENCE_TAG_PREFIX = 'confidence:';
const EVIDENCE_TAG_PREFIX = 'evidence:';

export function parseConfidenceLevel(
  value: string | undefined,
): ConfidenceLevel | undefined {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return undefined;
}

export function parseEvidenceRequirement(
  value: string | undefined,
): EvidenceRequirement | undefined {
  if (value === 'none' || value === 'recommended' || value === 'required') {
    return value;
  }
  return undefined;
}

export function tagValue(tags: string[] | undefined, prefix: string): string | null {
  if (!tags) {
    return null;
  }
  const match = tags.find((tag) => tag.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

export function resolveConfidenceLevel(input: {
  confidence_level?: ConfidenceLevel;
  tags?: string[];
}): ConfidenceLevel | undefined {
  if (input.confidence_level) {
    return input.confidence_level;
  }
  return parseConfidenceLevel(tagValue(input.tags, CONFIDENCE_TAG_PREFIX) ?? undefined);
}

export function resolveEvidenceRequirement(input: {
  evidence_requirement?: EvidenceRequirement;
  tags?: string[];
}): EvidenceRequirement | undefined {
  if (input.evidence_requirement) {
    return input.evidence_requirement;
  }
  return parseEvidenceRequirement(tagValue(input.tags, EVIDENCE_TAG_PREFIX) ?? undefined);
}

export function hasConfidenceClassification(input: {
  confidence_level?: ConfidenceLevel;
  tags?: string[];
}): boolean {
  return resolveConfidenceLevel(input) !== undefined;
}

export function hasEvidenceClassification(input: {
  evidence_requirement?: EvidenceRequirement;
  tags?: string[];
}): boolean {
  return resolveEvidenceRequirement(input) !== undefined;
}

export function scoreConfidenceLevel(level: ConfidenceLevel | undefined): number {
  if (level === 'high') {
    return 1;
  }
  if (level === 'medium') {
    return 0.85;
  }
  if (level === 'low') {
    return 0.5;
  }
  return 0;
}

export function scoreEvidenceRequirement(requirement: EvidenceRequirement | undefined): number {
  if (requirement === 'none' || requirement === 'recommended' || requirement === 'required') {
    return 1;
  }
  return 0;
}
