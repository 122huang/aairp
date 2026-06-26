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
};

function isWordChar(character: string): boolean {
  return /[a-zA-Z0-9_]/.test(character);
}

function hasValidTermBoundaries(text: string, start: number, length: number): boolean {
  const beforeOk = start === 0 || !isWordChar(text[start - 1]!);
  const afterOk = start + length >= text.length || !isWordChar(text[start + length]!);
  return beforeOk && afterOk;
}

function findTermIndex(text: string, term: string): number {
  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  let searchFrom = 0;

  while (searchFrom <= lowerText.length - lowerTerm.length) {
    const index = lowerText.indexOf(lowerTerm, searchFrom);
    if (index < 0) {
      return -1;
    }

    if (hasValidTermBoundaries(text, index, lowerTerm.length)) {
      return index;
    }

    searchFrom = index + 1;
  }

  return -1;
}

export function searchableFields(context: ReviewContext): SearchableField[] {
  const fields: SearchableField[] = [{ field: 'text', value: context.normalizedContent.text }];
  if (context.normalizedContent.ocrText) {
    fields.push({ field: 'ocr_text', value: context.normalizedContent.ocrText });
  }
  return fields;
}

export function findTermMatch(fields: SearchableField[], terms: string[]): TermMatch | null {
  const orderedTerms = [...terms].sort((a, b) => b.length - a.length);

  for (const { field, value } of fields) {
    for (const term of orderedTerms) {
      const index = findTermIndex(value, term);
      if (index >= 0) {
        return {
          field,
          start: index,
          end: index + term.length,
          text: value.slice(index, index + term.length),
        };
      }
    }
  }

  return null;
}

export function hasAnyTerm(fields: SearchableField[], terms: string[]): boolean {
  for (const { value } of fields) {
    for (const term of terms) {
      if (findTermIndex(value, term) >= 0) {
        return true;
      }
    }
  }
  return false;
}
