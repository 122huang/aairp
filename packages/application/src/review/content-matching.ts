import type { ReviewContext } from '@aairp/shared-kernel';

export type SearchableField = {
  field: string;
  value: string;
};

export type TermMatch = {
  field: string;
  start: number;
  end: number;
  text: string;
  term?: string;
};

function isAsciiWordChar(character: string): boolean {
  return /[a-zA-Z0-9_]/.test(character);
}

function termHasCjk(term: string): boolean {
  return /\p{Script=Han}/u.test(term);
}

function hasValidTermBoundaries(
  text: string,
  start: number,
  length: number,
  term: string,
): boolean {
  const beforeOk = start === 0 || !isAsciiWordChar(text[start - 1]!);

  if (termHasCjk(term)) {
    // CJK keywords are matched by substring; only reject when embedded inside ASCII tokens.
    return beforeOk;
  }

  const afterOk = start + length >= text.length || !isAsciiWordChar(text[start + length]!);
  return beforeOk && afterOk;
}

const UNIT_TOKEN = '(?:kg|g|lb|ml|l|w|kpa)';

/**
 * Expand orthography variants so rule triggers tolerate common PDP spellings:
 * non-stick / non stick / nonstick, 2kg / 2 kg.
 */
export function expandTermVariants(term: string): string[] {
  const base = term.trim();
  if (!base) {
    return [];
  }

  const variants = new Set<string>([base]);
  const lower = base.toLowerCase();

  if (/non[\s-]?stick/.test(lower) || lower.includes('nonstick')) {
    variants.add(base.replace(/non[\s-]?stick/gi, 'non-stick'));
    variants.add(base.replace(/non[\s-]?stick/gi, 'non stick'));
    variants.add(base.replace(/non[\s-]?stick/gi, 'nonstick'));
    variants.add(lower.replace(/non[\s-]?stick/g, 'non-stick'));
    variants.add(lower.replace(/non[\s-]?stick/g, 'non stick'));
    variants.add(lower.replace(/non[\s-]?stick/g, 'nonstick'));
  }

  // Number + unit with / without space
  const unitRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b`, 'i');
  if (unitRe.test(lower)) {
    const compact = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b`, 'gi');
    variants.add(lower.replace(compact, '$1$2'));
    variants.add(lower.replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b`, 'gi'), '$1 $2'));
    variants.add(base.replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b`, 'gi'), '$1$2'));
    variants.add(base.replace(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b`, 'gi'), '$1 $2'));
  }

  return [...variants];
}

function findExactTermIndex(text: string, term: string): number {
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let searchFrom = 0;

  while (searchFrom <= lowerText.length - lowerTerm.length) {
    const index = lowerText.indexOf(lowerTerm, searchFrom);
    if (index < 0) {
      return -1;
    }

    if (hasValidTermBoundaries(text, index, lowerTerm.length, term)) {
      return index;
    }

    searchFrom = index + 1;
  }

  return -1;
}

function findTermIndex(text: string, term: string): { index: number; length: number } | null {
  for (const variant of expandTermVariants(term)) {
    const index = findExactTermIndex(text, variant);
    if (index >= 0) {
      return { index, length: variant.length };
    }
  }
  return null;
}

export function searchableFields(context: ReviewContext): SearchableField[] {
  const fields: SearchableField[] = [{ field: 'text', value: context.normalizedContent.text }];
  if (context.normalizedContent.ocrText) {
    fields.push({ field: 'ocr_text', value: context.normalizedContent.ocrText });
  }
  if (context.normalizedContent.visionText) {
    fields.push({ field: 'vision_text', value: context.normalizedContent.visionText });
  }
  return fields;
}

export function findTermMatch(fields: SearchableField[], terms: string[]): TermMatch | null {
  const orderedTerms = [...terms].sort((a, b) => b.length - a.length);

  for (const { field, value } of fields) {
    for (const term of orderedTerms) {
      const hit = findTermIndex(value, term);
      if (hit) {
        return {
          field,
          start: hit.index,
          end: hit.index + hit.length,
          text: value.slice(hit.index, hit.index + hit.length),
          term,
        };
      }
    }
  }

  return null;
}

export function hasAnyTerm(fields: SearchableField[], terms: string[]): boolean {
  for (const { value } of fields) {
    for (const term of terms) {
      if (findTermIndex(value, term)) {
        return true;
      }
    }
  }
  return false;
}

export function findPatternMatch(fields: SearchableField[], patterns: string[]): TermMatch | null {
  for (const { field, value } of fields) {
    for (const pattern of patterns) {
      const match = new RegExp(pattern, 'i').exec(value);
      if (match?.index !== undefined) {
        const start = match.index;
        const end = start + match[0].length;
        return {
          field,
          start,
          end,
          text: value.slice(start, end),
          term: pattern,
        };
      }
    }
  }

  return null;
}

/** Join Vision extracted_text lines for rule matching. */
export function joinVisionExtractedText(extractedText?: string[]): string | undefined {
  if (!extractedText?.length) {
    return undefined;
  }
  const joined = extractedText
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
  return joined.length > 0 ? joined : undefined;
}
