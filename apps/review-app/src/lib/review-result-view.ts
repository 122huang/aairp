import type { ClaimOpinion } from '@aairp/shared-kernel';
import { resolveLegalSummaryZh } from '@/lib/legal-copy';

export type ReviewSectionDecision = 'PASS' | 'WARN' | 'REVIEW' | 'REJECT' | 'NONE' | 'NOT_EVALUATED';

export type ReviewSectionStatus = {
  decision: ReviewSectionDecision;
  label: string;
  summary: string;
};

const COPY_OPINION_KINDS = new Set<ClaimOpinion['kind']>([
  'prohibited',
  'needs_substantiation',
  'substantiation_weak',
  'substantiation_supports',
  'copy_only',
]);

const EVIDENCE_OPINION_KINDS = new Set<ClaimOpinion['kind']>([
  'needs_substantiation',
  'substantiation_weak',
  'substantiation_supports',
  'unused_evidence',
  'evidence_not_evaluated',
]);

export function decisionLabelZh(decision: string): string {
  switch (decision) {
    case 'PASS':
      return '通过';
    case 'WARN':
      return '需关注';
    case 'REVIEW':
      return '需复核';
    case 'REJECT':
      return '不建议发布';
    case 'NONE':
      return '未附材料';
    case 'NOT_EVALUATED':
      return '材料未进入实证判断';
    default:
      return decision;
  }
}

export function copySectionStatus(
  copyDecision: string,
  findingsCount: number,
): ReviewSectionStatus {
  const decision = normalizeDecision(copyDecision);
  return {
    decision,
    label: decisionLabelZh(decision),
    summary: copySectionSummary(decision, findingsCount),
  };
}

export function evidenceSectionStatus(
  opinions: ClaimOpinion[],
  evidenceCleared?: boolean,
): ReviewSectionStatus {
  if (!hasSubmittedEvidence(opinions)) {
    return {
      decision: 'NONE',
      label: '未附材料',
      summary: '本次未提交支撑材料；须实证项仅作文案层提示。',
    };
  }

  if (evidenceCleared) {
    return {
      decision: 'PASS',
      label: '材料可支持',
      summary: '所附材料可支持须实证项。审核以提交材料真实为前提。',
    };
  }

  const evidenceOpinions = filterEvidenceOpinions(opinions);
  const notEvaluatedOnly =
    evidenceOpinions.length > 0 &&
    evidenceOpinions.every((opinion) => opinion.kind === 'evidence_not_evaluated');
  if (notEvaluatedOnly) {
    return {
      decision: 'NOT_EVALUATED',
      label: '材料未进入实证判断',
      summary: '本次文案未识别到需要材料佐证的风险宣称，因此所附材料未进入相关性及充分性判断。',
    };
  }

  if (evidenceOpinions.some((opinion) => opinion.kind === 'substantiation_weak')) {
    return {
      decision: 'WARN',
      label: '材料不足',
      summary: '部分须实证项所附材料不符或尚不充分。',
    };
  }

  if (
    evidenceOpinions.length > 0 &&
    evidenceOpinions.every((opinion) => opinion.kind === 'unused_evidence')
  ) {
    return {
      decision: 'WARN',
      label: '材料未对应',
      summary: '所附材料未能对应到本次文案中的须实证宣称。',
    };
  }

  if (evidenceOpinions.some((opinion) => opinion.kind === 'substantiation_supports')) {
    return {
      decision: 'WARN',
      label: '部分可支持',
      summary: '部分宣称已有材料支持，其余须实证项仍待补充或人工确认。',
    };
  }

  return {
    decision: 'NONE',
    label: '无适用项',
    summary: '本次文案无可附材料的须实证宣称，或所附材料未纳入判断。',
  };
}

export function filterCopyOpinions(opinions: ClaimOpinion[]): ClaimOpinion[] {
  return opinions.filter((opinion) => COPY_OPINION_KINDS.has(opinion.kind));
}

export function filterEvidenceOpinions(opinions: ClaimOpinion[]): ClaimOpinion[] {
  return opinions.filter((opinion) => EVIDENCE_OPINION_KINDS.has(opinion.kind));
}

/** One-line Chinese hit path for UI; hides engine ref_ids and English summaries. */
export function briefHitPath(opinion: ClaimOpinion): string | undefined {
  const mapped = resolveLegalSummaryZh({
    refIds: opinion.ref_ids,
    riskType: '',
    summary: '',
  });
  if (mapped && mapped !== '') {
    return mapped.split('——')[0]?.trim() || mapped;
  }
  return undefined;
}

function normalizeDecision(value: string): ReviewSectionDecision {
  if (value === 'PASS' || value === 'WARN' || value === 'REJECT' || value === 'REVIEW') {
    return value;
  }
  return 'WARN';
}

function copySectionSummary(decision: ReviewSectionDecision, findingsCount: number): string {
  switch (decision) {
    case 'PASS':
      return '文案层未发现需关注的风险项。';
    case 'WARN':
      return findingsCount > 0
        ? `文案层发现 ${findingsCount} 项需关注的风险，发布前需人工处理。`
        : '文案层存在需关注的风险，发布前需人工处理。';
    case 'REVIEW':
      return findingsCount > 0
        ? `文案层发现 ${findingsCount} 项需人工复核的风险。`
        : '文案层存在需人工复核的风险。';
    case 'REJECT':
      return findingsCount > 0
        ? `文案层发现 ${findingsCount} 项风险，不建议发布。`
        : '文案层存在阻断级风险，不建议发布。';
    default:
      return '文案层审核已完成。';
  }
}

function hasSubmittedEvidence(opinions: ClaimOpinion[]): boolean {
  return opinions.some(
    (opinion) =>
      opinion.kind === 'unused_evidence' ||
      opinion.kind === 'evidence_not_evaluated' ||
      opinion.kind === 'substantiation_weak' ||
      opinion.kind === 'substantiation_supports' ||
      (opinion.evidence?.length ?? 0) > 0,
  );
}
