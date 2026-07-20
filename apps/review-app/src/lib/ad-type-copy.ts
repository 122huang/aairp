/** Shared copy for content-type (ad_type) UX + disclosure reminder. */

export type AdTypeValue = '' | 'BRAND_PRODUCT' | 'INFLUENCER_UGC';

export const AD_TYPE_OPTIONS: Array<{ value: AdTypeValue; label: string }> = [
  { value: 'BRAND_PRODUCT', label: '是，品牌自己发布（不需要披露标签）' },
  {
    value: 'INFLUENCER_UGC',
    label: '不是，是花钱找网红/达人合作发布的（发布前需加#ad/#PR等披露标签）',
  },
  { value: '', label: '不确定，按文案内容自动判断（默认）' },
];

/** Shown once in the conclusion area regardless of whether ad_type was set. */
export const DISCLOSURE_REMINDER_TEXT =
  '提醒：如果这条内容是品牌自己发布，不需要加披露标签；如果是花钱找网红/达人发布，请在发布前确认已加#ad/#PR等强制披露标签。';
