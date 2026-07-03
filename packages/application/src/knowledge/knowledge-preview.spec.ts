import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildKnowledgePreviewReport,
  formatKnowledgePreviewMarkdown,
  PREVIEW_DISCLAIMER,
} from './knowledge-preview.service.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('knowledge-preview.service', () => {
  it('does not import review pipeline services', () => {
    const source = readFileSync(join(here, 'knowledge-preview.service.ts'), 'utf8');
    expect(source).not.toMatch(/review-pipeline|rule-engine|open-risk|decision-engine/);
    expect(source).not.toMatch(/llm-gateway|LlmGateway/);
  });

  it('builds deterministic preview with relevant knowledge wording', () => {
    const report = buildKnowledgePreviewReport(
      { claim_text: 'removes 99.9999% bacteria', country: 'SG' },
      { now: new Date('2026-07-01T12:00:00.000Z') },
    );

    expect(report.disclaimer).toBe(PREVIEW_DISCLAIMER);
    expect(report.headline).not.toMatch(/violation/i);
    expect(report.headline.toLowerCase()).toContain('relevant knowledge');
    expect(report.preview_id).toMatch(/^preview-/);
    expect(report.matched_skills.length).toBeGreaterThan(0);
    expect(report.primary_skill).toBe(report.matched_skills[0]?.knowledge_id ?? null);
    expect(report.primary_skill_label).toBeTruthy();
    expect(report.claim_text_hash).toHaveLength(16);
    expect(report.evaluation_reference).toBeTruthy();
  });

  it('includes draft warning in markdown when pack is draft-only', () => {
    const report = buildKnowledgePreviewReport(
      { claim_text: 'clinically proven', country: 'SG' },
      { now: new Date('2026-07-01T12:00:00.000Z') },
    );
    const markdown = formatKnowledgePreviewMarkdown(report);
    expect(markdown).toContain('Knowledge Preview Report');
    expect(markdown).not.toMatch(/violation detected/i);
    if (report.draft_warning) {
      expect(markdown).toContain(report.draft_warning);
    }
  });
});
