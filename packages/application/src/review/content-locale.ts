/** Review UI / finding copy locale: Chinese vs English only (not full market languages). */
export type ReviewCopyLocale = 'zh' | 'en';

/**
 * Detect primary copy language from ad text.
 * More CJK ideographs than Latin letters → zh; otherwise en.
 */
export function detectReviewCopyLocale(text: string): ReviewCopyLocale {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return cjk > latin ? 'zh' : 'en';
}

export function pickLocalizedCopy(
  locale: ReviewCopyLocale,
  options: { en?: string; zh?: string; fallback: string },
): string {
  if (locale === 'zh') {
    return options.zh?.trim() || options.fallback;
  }
  return options.en?.trim() || options.fallback;
}
