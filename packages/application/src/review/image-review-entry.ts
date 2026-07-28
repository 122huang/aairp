/**
 * Image-review entry feature flag (review-app third tab).
 * Default off so production can roll back by env alone.
 */
export type ImageReviewEntryMode = 'off' | 'on';

export type ImageReviewRuntimeInfo = {
  image_review_entry: ImageReviewEntryMode;
  image_review_entry_source: 'AAIRP_IMAGE_REVIEW_ENTRY' | 'default_off_when_unset';
};

export function resolveImageReviewEntryMode(
  env: NodeJS.ProcessEnv = process.env,
): ImageReviewEntryMode {
  const raw = env.AAIRP_IMAGE_REVIEW_ENTRY?.trim().toLowerCase();
  if (raw === 'on' || raw === '1' || raw === 'true') {
    return 'on';
  }
  return 'off';
}

export function isImageReviewEntryEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveImageReviewEntryMode(env) === 'on';
}

export function getImageReviewRuntimeInfo(
  env: NodeJS.ProcessEnv = process.env,
): ImageReviewRuntimeInfo {
  const explicit = env.AAIRP_IMAGE_REVIEW_ENTRY?.trim().toLowerCase();
  return {
    image_review_entry: resolveImageReviewEntryMode(env),
    image_review_entry_source:
      explicit === 'on' ||
      explicit === 'off' ||
      explicit === '1' ||
      explicit === '0' ||
      explicit === 'true' ||
      explicit === 'false'
        ? 'AAIRP_IMAGE_REVIEW_ENTRY'
        : 'default_off_when_unset',
  };
}

export type ReviewEntryMode = 'single' | 'batch' | 'image';

export function parseReviewEntryMode(raw: unknown): ReviewEntryMode | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'single' || trimmed === 'batch' || trimmed === 'image') {
    return trimmed;
  }
  return undefined;
}

export function entryModeTag(mode: ReviewEntryMode): string {
  return `entry_mode:${mode}`;
}

export function readEntryModeFromTags(tags: string[] | undefined): ReviewEntryMode | undefined {
  if (!tags?.length) {
    return undefined;
  }
  for (const tag of tags) {
    if (tag.startsWith('entry_mode:')) {
      return parseReviewEntryMode(tag.slice('entry_mode:'.length));
    }
  }
  return undefined;
}
