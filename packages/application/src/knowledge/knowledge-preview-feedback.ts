import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from './knowledge-pack.js';
import type { KnowledgeEvalLinkageStamp } from './knowledge-eval-linkage.js';

export type PreviewFeedbackType = 'yes' | 'needs_update';

export type FeedbackLifecycleStatus =
  | 'captured'
  | 'reviewed'
  | 'converted'
  | 'implemented'
  | 'released';

export type PreviewFeedbackRecord = {
  feedback_id: string;
  recorded_at: string;
  lifecycle_status: FeedbackLifecycleStatus;
  feedback_type: PreviewFeedbackType;
  preview_id: string;
  knowledge_pack_id: string | null;
  knowledge_pack_fingerprint: string | null;
  corpus_fingerprints: Record<string, string> | null;
  evaluation_reference: string;
  primary_skill: string | null;
  matched_skills: string[];
  matched_corpus_entries: string[];
  country: string | null;
  claim_text_hash: string;
  reviewer_role: string | null;
};

export type RecordPreviewFeedbackInput = {
  preview_id: string;
  feedback_type: PreviewFeedbackType;
  claim_text_hash: string;
  primary_skill?: string | null;
  matched_skills?: string[];
  matched_corpus_entries?: string[];
  country?: string | null;
  reviewer_role?: string | null;
  linkage: KnowledgeEvalLinkageStamp;
  now?: Date;
  storePath?: string;
};

export function feedbackStorePath(): string {
  return join(repoRoot(), 'reports/feedback/preview-feedback.jsonl');
}

export function readPreviewFeedbackRecords(): PreviewFeedbackRecord[] {
  const path = feedbackStorePath();
  if (!existsSync(path)) {
    return [];
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PreviewFeedbackRecord);
}

export function recordPreviewFeedback(input: RecordPreviewFeedbackInput): PreviewFeedbackRecord {
  const now = input.now ?? new Date();
  const record: PreviewFeedbackRecord = {
    feedback_id: `fb-${randomUUID()}`,
    recorded_at: now.toISOString(),
    lifecycle_status: 'captured',
    feedback_type: input.feedback_type,
    preview_id: input.preview_id,
    knowledge_pack_id: input.linkage.knowledge_pack_id,
    knowledge_pack_fingerprint: input.linkage.knowledge_pack_fingerprint,
    corpus_fingerprints: input.linkage.corpus_fingerprints,
    evaluation_reference: input.linkage.evaluation_reference,
    primary_skill: input.primary_skill ?? null,
    matched_skills: input.matched_skills ?? [],
    matched_corpus_entries: input.matched_corpus_entries ?? [],
    country: input.country ?? null,
    claim_text_hash: input.claim_text_hash,
    reviewer_role: input.reviewer_role ?? null,
  };

  const path = input.storePath ?? feedbackStorePath();
  mkdirSync(join(path, '..'), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`);
  return record;
}

export function collectMatchedCorpusIds(linked: {
  regulations: Array<{ knowledge_id: string }>;
  evidence: Array<{ knowledge_id: string }>;
  rewrites: Array<{ knowledge_id: string }>;
  cases: Array<{ knowledge_id: string }>;
}): string[] {
  const ids = new Set<string>();
  for (const item of linked.regulations) {
    ids.add(item.knowledge_id);
  }
  for (const item of linked.evidence) {
    ids.add(item.knowledge_id);
  }
  for (const item of linked.rewrites) {
    ids.add(item.knowledge_id);
  }
  for (const item of linked.cases) {
    ids.add(item.knowledge_id);
  }
  return [...ids].sort();
}
