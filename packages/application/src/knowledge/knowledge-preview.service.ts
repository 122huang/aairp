import { randomUUID, createHash } from 'node:crypto';
import { loadCaseCorpusEntries } from './case-corpus.js';
import { loadEvidenceCorpusEntries } from './evidence-corpus.js';
import { loadRegulationCorpusEntries } from './regulation-corpus.js';
import { loadRewriteCorpusEntries } from './rewrite-corpus.js';
import { loadSkillCorpusEntries, type SkillCorpusEntry } from './skill-corpus.js';
import { skillEntryLinkage } from './corpus/skill-entry.adapter.js';
import {
  resolvePackForVisibility,
} from './knowledge-visibility-snapshot.js';
import { resolveKnowledgeEvalLinkageStamp } from './knowledge-eval-linkage.js';

export const PREVIEW_DISCLAIMER =
  'Knowledge Preview — not a compliance decision. Relevant knowledge found using governed corpus linkage only. No rules were executed and no LLM was called.';

export type KnowledgePreviewInput = {
  claim_text: string;
  country?: string;
  category?: string;
  modality?: string;
};

export type MatchedSkillPreview = {
  knowledge_id: string;
  label: string;
  match_reason: string;
  confidence: 'low' | 'medium' | 'high';
  score: number;
};

export type LinkedKnowledgePreview = {
  regulations: Array<{ knowledge_id: string; label: string; summary: string }>;
  evidence: Array<{
    knowledge_id: string;
    label: string;
    summary: string;
    requirement_level?: string;
  }>;
  rewrites: Array<{ knowledge_id: string; label: string; summary: string; strategy?: string }>;
  cases: Array<{
    knowledge_id: string;
    label: string;
    summary: string;
    benchmark_ref?: string;
  }>;
  rules: Array<{ rule_id: string; label: string }>;
};

export type KnowledgePreviewReport = {
  preview_id: string;
  generated_at: string;
  disclaimer: string;
  draft_warning: string | null;
  knowledge_pack_id: string | null;
  knowledge_pack_release_status: string;
  knowledge_pack_fingerprint: string | null;
  corpus_fingerprints: Record<string, string> | null;
  evaluation_reference: string;
  claim_text_hash: string;
  headline: string;
  input_summary: {
    claim_text: string;
    detected_signals: string[];
    country?: string;
    category?: string;
  };
  matched_skills: MatchedSkillPreview[];
  primary_skill: string | null;
  primary_skill_label: string | null;
  claim_types: string[];
  linked_knowledge: LinkedKnowledgePreview;
  guidance_excerpt: {
    review_guidance: string | null;
    rewrite_hint: string | null;
  };
};

function titleFromId(stableKey: string): string {
  return stableKey
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsTerm(text: string, term: string): boolean {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.includes(' ')) {
    return text.toLowerCase().includes(normalized);
  }
  const pattern = new RegExp(`\\b${escapeRegex(normalized)}\\b`, 'i');
  return pattern.test(text);
}

function matchSkills(input: KnowledgePreviewInput): MatchedSkillPreview[] {
  const text = input.claim_text;
  const matches: MatchedSkillPreview[] = [];

  for (const skill of loadSkillCorpusEntries()) {
    if (input.country && !skill.input_definition.countries.includes(input.country)) {
      continue;
    }
    const matchedTerms: string[] = [];
    for (const pattern of skill.detection_patterns) {
      for (const term of pattern.signal_terms ?? []) {
        if (containsTerm(text, term)) {
          matchedTerms.push(term);
        }
      }
      for (const concept of pattern.signal_concepts ?? []) {
        if (containsTerm(text, concept)) {
          matchedTerms.push(concept);
        }
      }
    }

    const uniqueTerms = [...new Set(matchedTerms)];
    if (uniqueTerms.length === 0) {
      continue;
    }

    const score = uniqueTerms.length;
    matches.push({
      knowledge_id: skill.knowledge_id,
      label: titleFromId(skill.skill_id),
      match_reason: `signal_terms: ${uniqueTerms.slice(0, 5).join(', ')}`,
      confidence: score >= 3 ? 'high' : score >= 2 ? 'medium' : 'low',
      score,
    });
  }

  return matches.sort((a, b) => b.score - a.score);
}

function expandLinkedKnowledge(skillIds: string[]): LinkedKnowledgePreview {
  const regulationIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const rewriteIds = new Set<string>();
  const ruleIds = new Set<string>();
  const caseIds = new Set<string>();

  for (const skillId of skillIds) {
    const skill = loadSkillCorpusEntries().find((entry) => entry.knowledge_id === skillId);
    if (!skill) {
      continue;
    }
    const linkage = skillEntryLinkage(skill);
    for (const id of linkage.regulations ?? []) {
      regulationIds.add(id);
    }
    for (const id of linkage.evidence ?? []) {
      evidenceIds.add(id);
    }
    for (const id of linkage.rewrites ?? []) {
      rewriteIds.add(id);
    }
    for (const id of linkage.rules ?? []) {
      ruleIds.add(id);
    }
    for (const rewriteId of skill.output_schema.rewrite_linkage ?? []) {
      rewriteIds.add(rewriteId);
    }
  }

  for (const entry of loadCaseCorpusEntries()) {
    if ((entry.linkage.skills ?? []).some((skillId) => skillIds.includes(skillId))) {
      caseIds.add(entry.knowledge_id);
    }
  }

  const regulations = loadRegulationCorpusEntries()
    .filter((entry) => regulationIds.has(entry.knowledge_id))
    .map((entry) => ({
      knowledge_id: entry.knowledge_id,
      label: entry.regulation_name,
      summary: entry.summary,
    }));

  const evidence = loadEvidenceCorpusEntries()
    .filter((entry) => evidenceIds.has(entry.knowledge_id))
    .map((entry) => ({
      knowledge_id: entry.knowledge_id,
      label: titleFromId(entry.evidence_id),
      summary: entry.summary,
      requirement_level: entry.requirement_level,
    }));

  const rewrites = loadRewriteCorpusEntries()
    .filter((entry) => rewriteIds.has(entry.knowledge_id))
    .map((entry) => ({
      knowledge_id: entry.knowledge_id,
      label: titleFromId(entry.rewrite_id),
      summary: entry.summary,
      strategy: entry.rewrite_strategy_type,
    }));

  const cases = loadCaseCorpusEntries()
    .filter((entry) => caseIds.has(entry.knowledge_id))
    .map((entry) => ({
      knowledge_id: entry.knowledge_id,
      label: titleFromId(entry.case_id),
      summary: entry.summary,
      benchmark_ref: entry.benchmark_ref,
    }));

  return {
    regulations,
    evidence,
    rewrites,
    cases,
    rules: [...ruleIds].map((ruleId) => ({ rule_id: ruleId, label: ruleId })),
  };
}

function collectClaimTypes(skills: SkillCorpusEntry[]): string[] {
  const claimTypes = new Set<string>();
  for (const skill of skills) {
    for (const claimType of skill.input_definition.claim_types) {
      claimTypes.add(claimType);
    }
  }
  return [...claimTypes].sort();
}

export function buildKnowledgePreviewReport(
  input: KnowledgePreviewInput,
  options?: { now?: Date },
): KnowledgePreviewReport {
  const now = options?.now ?? new Date();
  const { header } = resolvePackForVisibility(now);
  const linkage = resolveKnowledgeEvalLinkageStamp();
  const matched_skills = matchSkills(input);
  const primary = matched_skills[0] ?? null;
  const skillIds = matched_skills.map((item) => item.knowledge_id);
  const linked_knowledge = expandLinkedKnowledge(skillIds);

  const primarySkillEntry = primary
    ? loadSkillCorpusEntries().find((entry) => entry.knowledge_id === primary.knowledge_id)
    : undefined;

  const rewriteHint =
    linked_knowledge.rewrites[0]?.summary ??
    primarySkillEntry?.skill_behavior.rewrite_strategy ??
    null;

  const claim_types = primarySkillEntry
    ? collectClaimTypes(
        loadSkillCorpusEntries().filter((entry) => skillIds.includes(entry.knowledge_id)),
      )
    : [];

  const detected_signals = matched_skills.flatMap((item) =>
    item.match_reason.replace('signal_terms: ', '').split(', '),
  );

  return {
    preview_id: `preview-${randomUUID()}`,
    generated_at: now.toISOString(),
    disclaimer: PREVIEW_DISCLAIMER,
    draft_warning: header.draft_warning,
    knowledge_pack_id: header.knowledge_pack_id,
    knowledge_pack_release_status: header.release_status,
    knowledge_pack_fingerprint: linkage.knowledge_pack_fingerprint,
    corpus_fingerprints: linkage.corpus_fingerprints,
    evaluation_reference: linkage.evaluation_reference,
    claim_text_hash: createHash('sha256').update(input.claim_text).digest('hex').slice(0, 16),
    headline: primary
      ? `Relevant knowledge found for ${primary.label}`
      : 'No strongly matched skill knowledge found',
    input_summary: {
      claim_text: input.claim_text,
      detected_signals: [...new Set(detected_signals)].slice(0, 10),
      country: input.country,
      category: input.category,
    },
    matched_skills,
    primary_skill: primary?.knowledge_id ?? null,
    primary_skill_label: primary?.label ?? null,
    claim_types,
    linked_knowledge,
    guidance_excerpt: {
      review_guidance: primarySkillEntry?.review_guidance ?? null,
      rewrite_hint: rewriteHint,
    },
  };
}

export function formatKnowledgePreviewMarkdown(report: KnowledgePreviewReport): string {
  const lines = [
    '# Knowledge Preview Report',
    '',
    `> ${report.disclaimer}`,
  ];
  if (report.draft_warning) {
    lines.push('', `> **${report.draft_warning}**`);
  }
  lines.push(
    '',
    `**Knowledge Pack:** ${report.knowledge_pack_id ?? '(none)'} (${report.knowledge_pack_release_status})`,
    `**Headline:** ${report.headline}`,
    `**Claim:** "${report.input_summary.claim_text}"`,
    '',
    '## Matched Skills',
  );
  if (report.matched_skills.length === 0) {
    lines.push('', '_No skill knowledge matched the provided claim text._');
  } else {
    for (const skill of report.matched_skills) {
      const primaryMark = skill.knowledge_id === report.primary_skill ? ' *(primary)*' : '';
      lines.push(`- **${skill.label}**${primaryMark} — ${skill.match_reason}`);
    }
  }
  lines.push('', '## Claim Types', '', report.claim_types.join(' · ') || '—', '', '## Linked Regulations');
  for (const item of report.linked_knowledge.regulations) {
    lines.push(`- ${item.label}: ${item.summary.slice(0, 120)}…`);
  }
  lines.push('', '## Required Evidence');
  for (const item of report.linked_knowledge.evidence) {
    lines.push(`- ${item.label} (${item.requirement_level ?? 'n/a'})`);
  }
  lines.push('', '## Rewrite Guidance');
  for (const item of report.linked_knowledge.rewrites) {
    lines.push(`- ${item.label} (${item.strategy ?? 'n/a'})`);
  }
  lines.push('', '## Related Validation Cases');
  for (const item of report.linked_knowledge.cases) {
    lines.push(`- ${item.label}${item.benchmark_ref ? ` (benchmark ${item.benchmark_ref})` : ''}`);
  }
  if (report.guidance_excerpt.review_guidance) {
    lines.push('', '## Review Guidance Excerpt', '', report.guidance_excerpt.review_guidance.slice(0, 280));
  }
  return lines.join('\n');
}
