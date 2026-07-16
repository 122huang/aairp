import type { MergedFinding } from '@/lib/finding-merge';

/** rule_id / pattern_id → 法务简短中文摘要（标题式） */
export const LEGAL_SUMMARY_ZH: Record<string, string> = {
  'demo-apac-sa-health-implication': '健康暗示——感受类表述须附数据或软化',
  'sa-health-implication': '健康暗示——须语境限定或软化，少油类须持有对比数据',
  'sa-diet-oil-wellness': '饮食健康暗示——须持有烹调用油对比或营养依据',
  'demo-apac-sa-health-claim-blocker': '医疗宣称——疾病/器官功能类表述须删除',
  'sa-medical-claim': '医疗宣称——超出小家电广告允许范围',
  'demo-apac-sa-absolute-claim-soft': '绝对化性能表述——须加使用条件或典型结果',
  'sa-absolute-performance': '绝对化措辞——须限定场景或提供依据',
  'demo-apac-sa-comparative-claim': '比较性表述——须补充对比条件或删除',
  'demo-apac-sa-performance-claim': '量化性能宣称——须补充测试条件或数据来源',
  'demo-apac-sa-certification-evidence': '认证/专利引用——须确认有效证书并规范引用',
  'demo-apac-sa-ai-image-disclaimer': 'AI 生成内容——须添加必要声明或标注',
  'demo-apac-sa-localization': '本地化合规——须检查目标市场语言与标识',
};

const LEGAL_SUMMARY_ZH_BY_RISK_TYPE: Record<string, string> = {
  'health-implication': '健康暗示——感受类表述须附数据或软化',
  'health-claim-blocker': '医疗宣称——疾病/器官功能类表述须删除',
  'absolute-claim-soft': '绝对化性能表述——须加使用条件或典型结果',
  'comparative-claim': '比较性表述——须补充对比条件或删除',
  'performance-claim': '量化性能宣称——须补充测试条件或数据来源',
  'certification-evidence': '认证/专利引用——须确认有效证书并规范引用',
  'ai-image-disclaimer': 'AI 生成内容——须添加必要声明或标注',
  'localisation-error': '本地化合规——须检查目标市场语言与标识',
};

export function legalDecisionBannerText(decision: string, findingsCount: number): string {
  switch (decision) {
    case 'PASS':
      return '未发现需关注的风险项。';
    case 'WARN':
      return `发现 ${findingsCount} 项需关注的风险，发布前需人工处理。`;
    case 'REJECT':
      return `发现 ${findingsCount} 项风险，不建议发布。`;
    default:
      return `发现 ${findingsCount} 项风险项。`;
  }
}

export function resolveLegalSummaryZh(finding: MergedFinding): string {
  for (const refId of finding.refIds) {
    const mapped = LEGAL_SUMMARY_ZH[refId];
    if (mapped) return mapped;
  }

  const byRiskType = LEGAL_SUMMARY_ZH_BY_RISK_TYPE[finding.riskType];
  if (byRiskType) return byRiskType;

  return finding.summary;
}
