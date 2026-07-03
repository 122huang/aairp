/** Demo review UI / API — supported country markets (6B-2 SEA expansion). */
export const DEMO_REVIEW_COUNTRIES = [
  { id: 'SG', label: '新加坡' },
  { id: 'MY', label: '马来西亚' },
  { id: 'TH', label: '泰国' },
  { id: 'ID', label: '印度尼西亚' },
  { id: 'VN', label: '越南' },
  { id: 'PH', label: '菲律宾' },
] as const;

export type DemoReviewCountryId = (typeof DEMO_REVIEW_COUNTRIES)[number]['id'];

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
