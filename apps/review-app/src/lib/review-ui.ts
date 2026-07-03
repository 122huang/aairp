export type HighlightSpan = {
  start: number;
  end: number;
  text: string;
};

const SEVERITY_RANK: Record<string, number> = {
  BLOCKER: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function severityRank(severity: string): number {
  return SEVERITY_RANK[severity.toUpperCase()] ?? 99;
}

export function shouldExpandByDefault(severity: string): boolean {
  const normalized = severity.toUpperCase();
  return normalized === 'BLOCKER' || normalized === 'HIGH';
}

export type DecisionBannerStyle = {
  bar: string;
  background: string;
  verdict: string;
  badge: string;
};

export function decisionBannerStyle(decision: string): DecisionBannerStyle {
  switch (decision) {
    case 'PASS':
      return {
        bar: 'border-l-pass',
        background: 'bg-[#F0FDF4]',
        verdict: 'text-pass',
        badge: 'bg-[#DCFCE7] text-pass',
      };
    case 'WARN':
      return {
        bar: 'border-l-warn',
        background: 'bg-[#FFFBEB]',
        verdict: 'text-warn',
        badge: 'bg-[#FEF3C7] text-warn',
      };
    case 'REJECT':
      return {
        bar: 'border-l-reject',
        background: 'bg-[#FEF2F2]',
        verdict: 'text-reject',
        badge: 'bg-[#FEE2E2] text-reject',
      };
    default:
      return {
        bar: 'border-l-gray-400',
        background: 'bg-white',
        verdict: 'text-ink',
        badge: 'bg-gray-100 text-gray-700',
      };
  }
}

export function severityBadgeClass(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'BLOCKER':
      return 'bg-[#FEE2E2] text-reject';
    case 'HIGH':
      return 'bg-[#FFEDD5] text-[#C2410C]';
    case 'MEDIUM':
      return 'bg-[#FEF3C7] text-warn';
    case 'LOW':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export function collectHighlightSpans(
  sourceText: string,
  spans: Array<{ text: string; start?: number; end?: number }>,
): HighlightSpan[] {
  const merged: HighlightSpan[] = [];
  const seen = new Set<string>();

  for (const span of spans) {
    const text = span.text?.trim();
    if (!text) continue;

    if (typeof span.start === 'number' && typeof span.end === 'number' && span.end > span.start) {
      const key = `${span.start}:${span.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ start: span.start, end: span.end, text: sourceText.slice(span.start, span.end) });
      }
      continue;
    }

    let searchFrom = 0;
    while (searchFrom < sourceText.length) {
      const index = sourceText.indexOf(text, searchFrom);
      if (index < 0) break;
      const key = `${index}:${index + text.length}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ start: index, end: index + text.length, text });
      }
      searchFrom = index + text.length;
    }
  }

  return merged.sort((a, b) => a.start - b.start);
}

export function renderHighlightedText(sourceText: string, spans: HighlightSpan[]): Array<string | { mark: string }> {
  if (!sourceText || spans.length === 0) {
    return [sourceText];
  }

  const parts: Array<string | { mark: string }> = [];
  let cursor = 0;

  for (const span of spans) {
    if (span.start > cursor) {
      parts.push(sourceText.slice(cursor, span.start));
    }
    parts.push({ mark: sourceText.slice(span.start, span.end) });
    cursor = span.end;
  }

  if (cursor < sourceText.length) {
    parts.push(sourceText.slice(cursor));
  }

  return parts;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

export async function filesToBase64(
  files: File[],
): Promise<{ previews: string[]; imageDataUrls: string[] }> {
  const previews = files.map((file) => URL.createObjectURL(file));
  const imageDataUrls = await Promise.all(files.map(readFileAsDataUrl));
  return { previews, imageDataUrls };
}

export function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const match = trimmed.match(/^[^.!?。；]+[.!?。；]?/u);
  return match ? match[0].trim() : trimmed;
}
