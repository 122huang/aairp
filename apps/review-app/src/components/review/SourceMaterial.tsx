import { renderHighlightedText } from '@/lib/review-ui';
import type { HighlightSpan } from '@/lib/review-ui';

type SourceMaterialProps = {
  text: string;
  disclaimerText?: string;
  highlightSpans: HighlightSpan[];
  imagePreviews?: string[];
};

export function SourceMaterial({
  text,
  disclaimerText,
  highlightSpans,
  imagePreviews = [],
}: SourceMaterialProps) {
  const parts = renderHighlightedText(text, highlightSpans);
  const hasImages = imagePreviews.length > 0;
  const sectionTitle = hasImages ? '素材预览' : '原始文案';
  const trimmedDisclaimer = disclaimerText?.trim();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">{sectionTitle}</h3>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
        {parts.map((part, index) =>
          typeof part === 'string' ? (
            <span key={index}>{part}</span>
          ) : (
            <mark key={index} className="rounded bg-highlight px-0.5 text-inherit">
              {part.mark}
            </mark>
          ),
        )}
      </div>
      {trimmedDisclaimer ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p className="mb-1 text-xs font-medium text-amber-900">免责声明 / 脚注</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">{trimmedDisclaimer}</p>
        </div>
      ) : null}
      {hasImages && (
        <div className="mt-4 flex flex-wrap gap-2">
          {imagePreviews.map((src, index) => (
            <img
              key={src}
              src={src}
              alt={`上传图片 ${index + 1}`}
              className="h-24 w-24 rounded-md border border-gray-200 object-cover"
            />
          ))}
        </div>
      )}
    </section>
  );
}
