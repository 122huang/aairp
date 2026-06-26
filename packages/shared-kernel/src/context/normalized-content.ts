export type NormalizedContent = {
  text: string;
  ocrText?: string;
  /** Fetched landing page body; unset in Happy Path until Content Normalization. */
  landingPageText?: string;
  /** Source URL only; not evaluated as page text by downstream modules in Happy Path. */
  landingUrl?: string;
  imageUrls: string[];
  language?: string;
};
