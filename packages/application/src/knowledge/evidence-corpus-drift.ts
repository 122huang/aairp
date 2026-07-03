import { loadEvidenceCorpusEntries } from './evidence-corpus.js';
import { loadRegulationCorpusEntries } from './regulation-corpus.js';
import { loadSkillCorpusEntries } from './skill-corpus.js';
import { resolveEvidenceRequirement } from './platform/knowledge-classification.js';

export type EvidenceDriftIssue = {
  severity: 'warn';
  code: string;
  target_id: string;
  message: string;
};

export type EvidenceDriftReport = {
  generated_at: string;
  evidence_corpus_count: number;
  issues: EvidenceDriftIssue[];
  summary: {
    evidence_required_regulations_without_link: number;
    skills_missing_evidence_linkage: number;
    regulations_with_evidence_ids: number;
  };
};

export function buildEvidenceDriftReport(options?: {
  customRoot?: string;
  now?: Date;
}): EvidenceDriftReport {
  const now = options?.now ?? new Date();
  const evidenceEntries = loadEvidenceCorpusEntries(options?.customRoot);
  const regulations = loadRegulationCorpusEntries();
  const skills = loadSkillCorpusEntries();
  const issues: EvidenceDriftIssue[] = [];

  const evidenceByRegulation = new Map<string, Set<string>>();
  for (const entry of evidenceEntries) {
    for (const regulationId of entry.linkage.regulations ?? []) {
      const bucket = evidenceByRegulation.get(regulationId) ?? new Set<string>();
      bucket.add(entry.knowledge_id);
      evidenceByRegulation.set(regulationId, bucket);
    }
  }

  let regulationsWithEvidenceIds = 0;
  let evidenceRequiredWithoutLink = 0;

  for (const regulation of regulations) {
    if (regulation.related_evidence_ids.length > 0) {
      regulationsWithEvidenceIds += 1;
    }

    const needsEvidence = regulation.tags?.includes('evidence:required');
    const linkedFromEvidence = evidenceByRegulation.has(regulation.knowledge_id);
    if (needsEvidence && !linkedFromEvidence && regulation.related_evidence_ids.length === 0) {
      evidenceRequiredWithoutLink += 1;
      issues.push({
        severity: 'warn',
        code: 'regulation_evidence_unlinked',
        target_id: regulation.regulation_id,
        message: `Regulation ${regulation.knowledge_id} tagged evidence:required but has no evidence linkage`,
      });
    }

    for (const evidenceId of regulation.related_evidence_ids) {
      if (!evidenceEntries.some((entry) => entry.knowledge_id === evidenceId)) {
        issues.push({
          severity: 'warn',
          code: 'unknown_regulation_evidence_ref',
          target_id: regulation.regulation_id,
          message: `related_evidence_ids references unknown evidence: ${evidenceId}`,
        });
      }
    }
  }

  let skillsMissingEvidence = 0;
  for (const skill of skills) {
    if (skill.skill_status === 'deprecated') {
      continue;
    }
    const requirement = skill.evidence_requirement ?? resolveEvidenceRequirement(skill);
    if (requirement === 'required' && (skill.linkage.evidence?.length ?? 0) === 0) {
      skillsMissingEvidence += 1;
      issues.push({
        severity: 'warn',
        code: 'skill_missing_evidence_linkage',
        target_id: skill.skill_id,
        message: `Skill ${skill.knowledge_id} requires evidence but linkage.evidence is empty`,
      });
    }
  }

  return {
    generated_at: now.toISOString(),
    evidence_corpus_count: evidenceEntries.length,
    issues,
    summary: {
      evidence_required_regulations_without_link: evidenceRequiredWithoutLink,
      skills_missing_evidence_linkage: skillsMissingEvidence,
      regulations_with_evidence_ids: regulationsWithEvidenceIds,
    },
  };
}

export function formatEvidenceDriftMarkdown(report: EvidenceDriftReport): string {
  const lines = [
    '# Evidence Corpus Drift Report',
    '',
    `Generated: ${report.generated_at}`,
    '',
    '## Summary',
    '',
    `- Evidence entries: ${report.evidence_corpus_count}`,
    `- Regulations with related_evidence_ids: ${report.summary.regulations_with_evidence_ids}`,
    `- evidence:required regulations without link: ${report.summary.evidence_required_regulations_without_link}`,
    `- Skills missing evidence linkage: ${report.summary.skills_missing_evidence_linkage}`,
    '',
    `## Issues (${report.issues.length})`,
    '',
  ];

  for (const issue of report.issues.slice(0, 50)) {
    lines.push(`- [${issue.code}] ${issue.target_id}: ${issue.message}`);
  }

  if (report.issues.length > 50) {
    lines.push(`- ... and ${report.issues.length - 50} more`);
  }

  return lines.join('\n');
}
