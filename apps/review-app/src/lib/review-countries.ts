import { DEMO_REVIEW_COUNTRIES, type DemoReviewCountryId } from '@aairp/shared-kernel';

export const REVIEW_APP_VISIBLE_COUNTRY_IDS = ['SG', 'MY', 'TH'] as const satisfies readonly DemoReviewCountryId[];

export const REVIEW_APP_VISIBLE_COUNTRIES = DEMO_REVIEW_COUNTRIES.filter((country) =>
  (REVIEW_APP_VISIBLE_COUNTRY_IDS as readonly string[]).includes(country.id),
);
