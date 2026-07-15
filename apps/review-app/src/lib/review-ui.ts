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
    case 'REVIEW':
      return {
        bar: 'border-l-blue-500',
        background: 'bg-[#EFF6FF]',
        verdict: 'text-blue-700',
        badge: 'bg-[#DBEAFE] text-blue-700',
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

const MAX_REVIEW_IMAGE_LONG_EDGE = 2000;
const MIN_REVIEW_IMAGE_SHORT_EDGE = 400;
const JPEG_QUALITY = 0.85;
const MAX_REVIEW_IMAGE_DATA_URL_LENGTH = Math.floor(3 * 1024 * 1024);

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    image.src = url;
  });
}

function encodeCanvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality);
}

function computeReviewImageDimensions(
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  const longEdge = Math.max(naturalWidth, naturalHeight);
  const shortEdge = Math.min(naturalWidth, naturalHeight);

  if (longEdge <= MAX_REVIEW_IMAGE_LONG_EDGE) {
    return { width: naturalWidth, height: naturalHeight };
  }

  const scaleByLong = MAX_REVIEW_IMAGE_LONG_EDGE / longEdge;
  if (shortEdge * scaleByLong >= MIN_REVIEW_IMAGE_SHORT_EDGE) {
    return {
      width: Math.max(1, Math.round(naturalWidth * scaleByLong)),
      height: Math.max(1, Math.round(naturalHeight * scaleByLong)),
    };
  }

  const scaleByShort = MIN_REVIEW_IMAGE_SHORT_EDGE / shortEdge;
  return {
    width: Math.max(1, Math.round(naturalWidth * scaleByShort)),
    height: Math.max(1, Math.round(naturalHeight * scaleByShort)),
  };
}

function drawImageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const { width, height } = computeReviewImageDimensions(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not supported in this browser');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

export async function compressImageForReview(file: File): Promise<string> {
  const image = await loadImageFromFile(file);
  const canvas = drawImageToCanvas(image);
  const dataUrl = encodeCanvasToJpegDataUrl(canvas, JPEG_QUALITY);

  if (dataUrl.length > MAX_REVIEW_IMAGE_DATA_URL_LENGTH) {
    throw new Error(
      `Compressed image exceeds 3MB data URL limit (${file.name}): ${(dataUrl.length / 1024 / 1024).toFixed(2)} MB`,
    );
  }

  return dataUrl;
}

export async function filesToBase64(
  files: File[],
): Promise<{ previews: string[]; imageDataUrls: string[] }> {
  const previews = files.map((file) => URL.createObjectURL(file));
  const imageDataUrls = await Promise.all(files.map((file) => compressImageForReview(file)));
  return { previews, imageDataUrls };
}

export function firstSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const match = trimmed.match(/^[^.!?。；]+[.!?。；]?/u);
  return match ? match[0].trim() : trimmed;
}
