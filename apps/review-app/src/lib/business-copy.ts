import type { MergedFinding } from '@/lib/finding-merge';

/** rule_id / pattern_id → 业务侧中文说明（后续可从 playbook guidance 拉取） */
export const BUSINESS_SUMMARY_ZH: Record<string, string> = {
  'demo-apac-sa-health-implication':
    '文案存在健康暗示表述，可能让观众联想到身体状态改善，需加限定语或提供依据后再发布。',
  'sa-health-implication':
    '文案使用了与健康、饮食轻松相关的暗示性表述，建议软化措辞或补充数据支持。',
  'sa-diet-oil-wellness':
    '「少油」「饮食轻松」等饮食健康暗示需持有烹调用油对比或合规营养依据后方可发布。',
  'demo-apac-sa-health-claim-blocker':
    '文案含有疾病、器官功能或医疗背书类表述，小家电广告不得作医疗宣称，须删除相关用语。',
  'sa-medical-claim':
    '文案涉及医疗或疾病相关宣称，超出小家电广告允许范围，须删除越线表述。',
  'demo-apac-sa-absolute-claim-soft':
    '文案使用了绝对化性能表述，建议加上使用条件或典型结果说明。',
  'sa-absolute-performance':
    '文案使用了「每次」「完美」等绝对化性能措辞，建议限定使用场景或提供依据。',
  'demo-apac-sa-comparative-claim':
    '文案含有未充分说明依据的比较性表述，建议补充对比条件或删除比较用语。',
  'demo-apac-sa-performance-claim':
    '文案含有量化性能宣称，建议补充测试条件或数据来源。',
  'demo-apac-sa-certification-evidence':
    '文案提及认证或专利信息，请确认持有有效证书并规范引用。',
  'demo-apac-sa-ai-image-disclaimer':
    '图片或文案可能涉及 AI 生成内容，需添加必要声明或标注。',
  'demo-apac-sa-localization':
    '文案存在本地化或语言合规问题，请检查目标市场语言与标识要求。',
};

/** rule_id / pattern_id → 法务视图简短中文摘要（标题式） */
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

const ENGLISH_SUMMARY_PATTERN = /^[\x20-\x7E\s]+$/;

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

export function businessDecisionLabel(decision: string): string {
  switch (decision) {
    case 'PASS':
      return '✓ 可以投放';
    case 'WARN':
      return '⚠ 需要修改后投放';
    case 'REJECT':
      return '✗ 不建议投放';
    default:
      return decision;
  }
}

export function businessSeverityStyle(severity: string): { label: string; className: string } {
  const normalized = severity.toUpperCase();
  if (normalized === 'BLOCKER' || normalized === 'HIGH') {
    return { label: '必须修改', className: 'bg-[#FEE2E2] text-reject' };
  }
  if (normalized === 'MEDIUM') {
    return { label: '建议修改', className: 'bg-[#FFEDD5] text-warn' };
  }
  return { label: '注意确认', className: 'bg-gray-100 text-gray-600' };
}

export function resolveBusinessSummary(finding: MergedFinding): string {
  for (const refId of finding.refIds) {
    const mapped = BUSINESS_SUMMARY_ZH[refId];
    if (mapped) return mapped;
  }

  if (ENGLISH_SUMMARY_PATTERN.test(finding.summary.trim())) {
    return '该文案存在合规风险，请按下方修改建议调整后重新提交。';
  }

  return finding.summary;
}
