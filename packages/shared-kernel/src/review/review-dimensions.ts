const DEMO_REVIEW_COUNTRY_DEFS = [
  { id: 'SG', label: '新加坡' },
  { id: 'MY', label: '马来西亚' },
  { id: 'TH', label: '泰国' },
  { id: 'ID', label: '印度尼西亚' },
  { id: 'VN', label: '越南' },
  { id: 'PH', label: '菲律宾' },
] as const;

export type DemoReviewCountryId = (typeof DEMO_REVIEW_COUNTRY_DEFS)[number]['id'];

/**
 * Country ids backed by an actual Legal market card (market profile, key regulations,
 * disclosure requirements, escalation triggers — same structure as the other market
 * cards already on file). Everything else runs on demo-level keyword rules only.
 *
 * VN and PH are intentionally NOT in this list: no market card has been written for
 * either yet. Do not add a country id here on engineering judgment alone — only once
 * Legal actually ships a market card for it. This exists so VN/PH decisions (and their
 * eval accuracy) aren't mistaken for the same legal confidence as an already-reviewed
 * market like SG/MY/TH.
 */
export const LEGAL_REVIEWED_MARKET_COUNTRY_IDS: ReadonlySet<string> = new Set([
  'SG',
  'MY',
  'TH',
  'ID',
  'JP',
  'KR',
  'AU',
  'CN',
]);

export function isLegalReviewedMarket(countryId: string): boolean {
  return LEGAL_REVIEWED_MARKET_COUNTRY_IDS.has(countryId.toUpperCase());
}

/** Demo review UI / API — supported country markets (6B-2 SEA expansion). */
export const DEMO_REVIEW_COUNTRIES = DEMO_REVIEW_COUNTRY_DEFS.map((country) => ({
  ...country,
  legal_reviewed: isLegalReviewedMarket(country.id),
}));

/** Small-appliance categories used in demo rules and dataset smoke cases. */
export const DEMO_SA_CATEGORIES = [
  { id: 'sa.vacuum_floor', label: '吸尘器 / 洗地' },
  { id: 'sa.steam_mop', label: '蒸汽拖把' },
  { id: 'sa.air_fryer', label: '空气炸锅' },
  { id: 'sa.blender_processor', label: '破壁机 / 料理机' },
  { id: 'sa.rice_cooker', label: '电饭煲' },
  { id: 'sa.soy_milk', label: '豆浆机' },
  { id: 'sa.coffee_espresso', label: '咖啡机' },
  { id: 'sa.kettle_cooker', label: '电水壶' },
  { id: 'sa.oven_steamer', label: '烤箱 / 蒸烤箱' },
  { id: 'sa.other', label: '其他小家电' },
] as const;

export type DemoSaCategoryId = (typeof DEMO_SA_CATEGORIES)[number]['id'];

export const DEMO_REVIEW_PLATFORM_ID = 'META' as const;
