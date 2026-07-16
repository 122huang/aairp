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
    case 'REVIEW':
      return `发现 ${findingsCount} 项需人工复核的风险，发布前须法务/产品合规确认。`;
    case 'REJECT':
      return `发现 ${findingsCount} 项风险，不建议发布。`;
    default:
      return `发现 ${findingsCount} 项风险项。`;
  }
}

/** 常驻「审核结果说明」— 决策档位（含 finding 级 INFO） */
export const DECISION_TIER_HELP = {
  title: '决策档位说明',
  body: [
    'PASS：未发现需处理风险，可按流程继续。',
    'WARN：有需修改或补证的风险，发布前人工处理；不自动拦截。',
    'REVIEW：须人工复核（内容解读/合规确认），发布前不得视为已放行。',
    'REJECT：存在阻断级问题，不建议发布。',
    'INFO（仅 finding）：信息性提醒，不参与最终决策融合、不占 REVIEW/WARN 名额；例如品类前置认证提醒。最终决策仍可为 PASS。',
  ].join('\n'),
} as const;

/** severity 与 decision 是两个独立维度 */
export const SEVERITY_VS_DECISION_HELP = {
  title: 'severity 与 decision',
  body: [
    'decision（如 INFO / WARN / REVIEW）：系统现在要不要拦、要不要人工处理。',
    'severity（如 HIGH / MEDIUM / LOW）：若该问题属实，法律/合规上的严重程度。',
    '二者独立：例如 INFO + HIGH =「现在不阻塞审核，但若 SKU 确实未注册，问题本身很严重」— 不是自相矛盾。',
  ].join('\n'),
} as const;

export function resolveLegalSummaryZh(finding: MergedFinding): string {
  for (const refId of finding.refIds) {
    const mapped = LEGAL_SUMMARY_ZH[refId];
    if (mapped) return mapped;
  }

  const byRiskType = LEGAL_SUMMARY_ZH_BY_RISK_TYPE[finding.riskType];
  if (byRiskType) return byRiskType;

  return finding.summary;
}
