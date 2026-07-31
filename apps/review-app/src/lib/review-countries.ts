import { DEMO_REVIEW_COUNTRIES, type DemoReviewCountryId } from '@aairp/shared-kernel';

/** Product submit UI: 新马泰 + AU/CN/JP/KR (legal-approved). ID/IN/VN/PH stay off the selector. */
export const REVIEW_APP_VISIBLE_COUNTRY_IDS = ['SG', 'MY', 'TH', 'AU', 'CN', 'JP', 'KR'] as const satisfies readonly DemoReviewCountryId[];

export const REVIEW_APP_VISIBLE_COUNTRIES = DEMO_REVIEW_COUNTRIES.filter((country) =>
  (REVIEW_APP_VISIBLE_COUNTRY_IDS as readonly string[]).includes(country.id),
);
