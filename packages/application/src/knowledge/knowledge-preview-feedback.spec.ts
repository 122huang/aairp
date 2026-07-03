import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  collectMatchedCorpusIds,
  readPreviewFeedbackRecords,
  recordPreviewFeedback,
} from './knowledge-preview-feedback.js';
import { buildKnowledgeGapReport } from './knowledge-gap-report.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('knowledge-preview-feedback', () => {
  it('does not import review pipeline services', () => {
    const source = readFileSync(join(here, 'knowledge-preview-feedback.ts'), 'utf8');
    expect(source).not.toMatch(/review-pipeline|rule-engine|open-risk|decision-engine/);
  });

  it('records metadata-only feedback without claim text', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aairp-feedback-'));
    const storePath = join(dir, 'preview-feedback.jsonl');

    const record = recordPreviewFeedback({
      preview_id: 'preview-test',
      feedback_type: 'needs_update',
      claim_text_hash: 'abc123hashonly',
      matched_skills: ['skill:performance-claim-review'],
      matched_corpus_entries: ['evidence:health-claim-substantiation'],
      linkage: {
        knowledge_pack_id: 'kp-test',
        knowledge_pack_fingerprint: 'fp-test',
        corpus_fingerprints: { skill: 'abc' },
        evaluation_reference: 'benchmark-v3-baseline-2026-06-30',
        regression_baseline_report: 'reports/eval-v3.json',
      },
      storePath,
    });

    expect(record.lifecycle_status).toBe('captured');
    expect(record.feedback_type).toBe('needs_update');
    expect(JSON.stringify(record)).not.toMatch(/"claim_text":/);
    expect(record.claim_text_hash).toBe('abc123hashonly');
    expect(record.knowledge_pack_id).toBe('kp-test');

    const stored = readFileSync(storePath, 'utf8');
    expect(stored).toContain('abc123hashonly');
    expect(stored).not.toMatch(/"claim_text":/);

    rmSync(dir, { recursive: true, force: true });
  });

  it('collects matched corpus ids from linked knowledge', () => {
    const ids = collectMatchedCorpusIds({
      regulations: [{ knowledge_id: 'reg:1' }],
      evidence: [{ knowledge_id: 'ev:1' }],
      rewrites: [],
      cases: [{ knowledge_id: 'case:1' }],
    });
    expect(ids).toEqual(['case:1', 'ev:1', 'reg:1']);
  });
});

describe('knowledge-gap-report', () => {
  it('does not import review pipeline services', () => {
    const source = readFileSync(join(here, 'knowledge-gap-report.ts'), 'utf8');
    expect(source).not.toMatch(/review-pipeline|rule-engine|open-risk|decision-engine/);
  });

  it('builds prioritized backlog with queue summary', () => {
    const report = buildKnowledgeGapReport({ now: new Date('2026-07-01T12:00:00.000Z') });
    expect(report.linkage.knowledge_pack_id).toBeTruthy();
    expect(report.queue_summary.p1_gaps).toBeGreaterThanOrEqual(0);
    expect(report.backlog.length).toBeGreaterThan(0);
    expect(report.backlog[0]?.priority).toMatch(/^P[1-5]$/);
    expect(report.linkage.evaluation_reference).toBeTruthy();
  });
});
