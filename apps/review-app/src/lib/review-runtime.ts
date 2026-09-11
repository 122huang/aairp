export function experimentalOpenRiskLabel(openRiskMode?: string): string | null {
  return openRiskMode === 'live' ? '实验性 Open Risk 已启用' : null;
}
