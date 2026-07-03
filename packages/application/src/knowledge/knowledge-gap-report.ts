import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCaseCorpusEntries } from './case-corpus.js';
import { loadRegulationCorpusEntries } from './regulation-corpus.js';
import { loadSkillCorpusEntries } from './skill-corpus.js';
import { skillEntryLinkage } from './corpus/skill-entry.adapter.js';
import { buildKnowledgePlatformSnapshot } from './platform/knowledge-platform.js';
import { readPreviewFeedbackRecords } from './knowledge-preview-feedback.js';
import {
  resolveKnowledgeEvalLinkageStamp,
  type KnowledgeEvalLinkageStamp,
} from './knowledge-eval-linkage.js';
import { buildKnowledgeGraphSnapshot } from './knowledge-graph-builder.js';
import { repoRoot } from './knowledge-pack.js';

export type GapPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export type KnowledgeGapItem = {
  priority: GapPriority;
  gap_type: string;
  corpus_type: string;
  subject_id: string;
  summary: string;
  suggested_action: string;
  owner: string;
};

export type ImprovementQueueSummary = {
  p1_gaps: number;
  p2_gaps: number;
  p3_gaps: number;
  p4_gaps: number;
  p5_gaps: number;
  evidence_gaps: number;
  unmapped_claims: number;
  feedback_needs_update: number;
};

export type KnowledgeGapReport = {
  generated_at: string;
  linkage: KnowledgeEvalLinkageStamp;
  queue_summary: ImprovementQueueSummary;
  backlog: KnowledgeGapItem[];
};

const KQS_THRESHOLD = 85;

function countUnmappedClaims(feedback: ReturnType<typeof readPreviewFeedbackRecords>): number {
  const hashes = new Set<string>();
  for (const record of feedback) {
    if (record.matched_skills.length === 0) {
      hashes.add(record.claim_text_hash);
    }
  }
  return hashes.size;
}

function detectP3Patterns(
  feedback: ReturnType<typeof readPreviewFeedbackRecords>,
): KnowledgeGapItem[] {
  const byHash = new Map<string, number>();
  for (const record of feedback) {
    if (record.feedback_type !== 'needs_update' || record.matched_skills.length > 0) {
      continue;
    }
    byHash.set(record.claim_text_hash, (byHash.get(record.claim_text_hash) ?? 0) + 1);
  }

  return [...byHash.entries()].map(([hash, count]) => ({
    priority: 'P3' as const,
    gap_type: 'repeated_unmatched_claim_pattern',
    corpus_type: 'skill',
    subject_id: hash,
    summary: `Unmatched claim pattern (${count} feedback signal${count > 1 ? 's' : ''})`,
    suggested_action: 'Add skill detection patterns or new review skill',
    owner: 'knowledge-eng',
  }));
}

export function buildKnowledgeGapReport(options?: { now?: Date }): KnowledgeGapReport {
  const now = options?.now ?? new Date();
  const linkage = resolveKnowledgeEvalLinkageStamp();
  const feedback = readPreviewFeedbackRecords();
  const backlog: KnowledgeGapItem[] = [];

  for (const skill of loadSkillCorpusEntries()) {
    const skillLinkage = skillEntryLinkage(skill);
    if ((skillLinkage.regulations ?? []).length === 0) {
      backlog.push({
        priority: 'P1',
        gap_type: 'missing_regulation_linkage',
        corpus_type: 'skill',
        subject_id: skill.knowledge_id,
        summary: `${skill.skill_id} has no regulation linkage`,
        suggested_action: 'Link governing regulations in skill corpus entry',
        owner: 'knowledge-eng',
      });
    }
    if ((skillLinkage.evidence ?? []).length === 0) {
      backlog.push({
        priority: 'P2',
        gap_type: 'missing_evidence_mapping',
        corpus_type: 'skill',
        subject_id: skill.knowledge_id,
        summary: `${skill.skill_id} has no required evidence mapping`,
        suggested_action: 'Link evidence requirements in skill corpus entry',
        owner: 'knowledge-eng',
      });
    }

    const termCount = skill.detection_patterns.reduce(
      (sum, pattern) =>
        sum + (pattern.signal_terms?.length ?? 0) + (pattern.signal_concepts?.length ?? 0),
      0,
    );
    if (termCount > 0 && termCount <= 2) {
      backlog.push({
        priority: 'P4',
        gap_type: 'low_confidence_mapping',
        corpus_type: 'skill',
        subject_id: skill.knowledge_id,
        summary: `${skill.skill_id} has sparse detection signals (${termCount})`,
        suggested_action: 'Expand signal_terms / signal_concepts for reliable matching',
        owner: 'knowledge-eng',
      });
    }
  }

  const graph = buildKnowledgeGraphSnapshot();
  const linkedRegulations = new Set(
    graph.edges.filter((edge) => edge.relation === 'governed_by').map((edge) => edge.to),
  );
  for (const regulation of loadRegulationCorpusEntries()) {
    if (!linkedRegulations.has(regulation.knowledge_id)) {
      backlog.push({
        priority: 'P1',
        gap_type: 'orphan_regulation',
        corpus_type: 'regulation',
        subject_id: regulation.knowledge_id,
        summary: `${regulation.regulation_name} is not linked from any skill`,
        suggested_action: 'Attach regulation to relevant review skill',
        owner: 'knowledge-eng',
      });
    }
  }

  backlog.push(...detectP3Patterns(feedback));

  for (const record of feedback) {
    if (record.feedback_type !== 'needs_update' || record.matched_skills.length === 0) {
      continue;
    }
    backlog.push({
      priority: 'P4',
      gap_type: 'low_confidence_feedback',
      corpus_type: 'skill',
      subject_id: record.primary_skill ?? record.preview_id,
      summary: `Feedback needs_update on preview ${record.preview_id}`,
      suggested_action: 'Review linkage and detection patterns for matched skill',
      owner: 'legal-pilot',
    });
  }

  const platform = buildKnowledgePlatformSnapshot(now);
  for (const corpus of platform.corpora) {
    if (corpus.knowledge_quality_score < KQS_THRESHOLD) {
      backlog.push({
        priority: 'P5',
        gap_type: 'low_kqs',
        corpus_type: corpus.corpus_type,
        subject_id: corpus.corpus_type,
        summary: `${corpus.corpus_type} KQS ${corpus.knowledge_quality_score.toFixed(1)} below ${KQS_THRESHOLD}`,
        suggested_action: 'Address governance warnings and freshness issues',
        owner: 'knowledge-eng',
      });
    }
    if (corpus.freshness.red > 0 || corpus.governance_warnings > 20) {
      backlog.push({
        priority: 'P5',
        gap_type: 'freshness_governance',
        corpus_type: corpus.corpus_type,
        subject_id: corpus.corpus_type,
        summary: `${corpus.corpus_type}: ${corpus.freshness.red} stale, ${corpus.governance_warnings} governance warnings`,
        suggested_action: 'Refresh stale entries and resolve governance warnings',
        owner: 'knowledge-eng',
      });
    }
  }

  for (const entry of loadCaseCorpusEntries()) {
    if (!entry.benchmark_ref) {
      backlog.push({
        priority: 'P3',
        gap_type: 'case_without_benchmark_ref',
        corpus_type: 'case',
        subject_id: entry.knowledge_id,
        summary: `${entry.case_id} has no benchmark_ref`,
        suggested_action: 'Link case to benchmark v3 case id',
        owner: 'eval-owner',
      });
    }
  }

  const priorityOrder: Record<GapPriority, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };
  backlog.sort(
    (a, b) =>
      priorityOrder[a.priority] - priorityOrder[b.priority] ||
      a.subject_id.localeCompare(b.subject_id),
  );

  const queue_summary: ImprovementQueueSummary = {
    p1_gaps: backlog.filter((item) => item.priority === 'P1').length,
    p2_gaps: backlog.filter((item) => item.priority === 'P2').length,
    p3_gaps: backlog.filter((item) => item.priority === 'P3').length,
    p4_gaps: backlog.filter((item) => item.priority === 'P4').length,
    p5_gaps: backlog.filter((item) => item.priority === 'P5').length,
    evidence_gaps: backlog.filter((item) => item.gap_type === 'missing_evidence_mapping').length,
    unmapped_claims: countUnmappedClaims(feedback),
    feedback_needs_update: feedback.filter((item) => item.feedback_type === 'needs_update').length,
  };

  return {
    generated_at: now.toISOString(),
    linkage,
    queue_summary,
    backlog,
  };
}

export function formatKnowledgeGapMarkdown(report: KnowledgeGapReport): string {
  const q = report.queue_summary;
  const lines = [
    '# Knowledge Coverage Gap Report',
    '',
    `**Generated:** ${report.generated_at}`,
    `**Knowledge Pack:** ${report.linkage.knowledge_pack_id ?? '(none)'}`,
    `**Fingerprint:** ${report.linkage.knowledge_pack_fingerprint ?? '(none)'}`,
    `**Evaluation reference:** ${report.linkage.evaluation_reference}`,
    '',
    '## Improvement queue',
    '',
    `| Queue | Count |`,
    `|-------|------:|`,
    `| P1 — regulation linkage | ${q.p1_gaps} |`,
    `| P2 — evidence mapping | ${q.p2_gaps} |`,
    `| P3 — unmatched / benchmark gaps | ${q.p3_gaps} |`,
    `| P4 — low confidence mapping | ${q.p4_gaps} |`,
    `| P5 — freshness / governance | ${q.p5_gaps} |`,
    `| Evidence gaps (P2 detail) | ${q.evidence_gaps} |`,
    `| Unmapped claims (feedback) | ${q.unmapped_claims} |`,
    `| Feedback needs update | ${q.feedback_needs_update} |`,
    '',
    '## Priority backlog',
    '',
    '| Priority | Gap | Corpus | Action | Owner |',
    '|----------|-----|--------|--------|-------|',
  ];

  for (const item of report.backlog.slice(0, 50)) {
    lines.push(
      `| ${item.priority} | ${item.summary.replace(/\|/g, '/')} | ${item.corpus_type} | ${item.suggested_action.replace(/\|/g, '/')} | ${item.owner} |`,
    );
  }
  if (report.backlog.length > 50) {
    lines.push('', `_…and ${report.backlog.length - 50} more items_`);
  }

  return lines.join('\n');
}

export function writeKnowledgeGapReport(options?: { now?: Date }): KnowledgeGapReport {
  const report = buildKnowledgeGapReport(options);
  const timestamp = report.generated_at.replace(/[:.]/g, '-');
  const reportsDir = join(repoRoot(), 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = join(reportsDir, `knowledge-gap-${timestamp}.json`);
  const mdPath = join(reportsDir, `knowledge-gap-${timestamp}.md`);
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, `${formatKnowledgeGapMarkdown(report)}\n`);
  return report;
}

export function summarizeImprovementQueue(options?: { now?: Date }): ImprovementQueueSummary {
  return buildKnowledgeGapReport(options).queue_summary;
}
