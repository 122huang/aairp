import { describe, expect, it } from 'vitest';
import {
  loadRewriteTemplates,
  matchRewriteExpectation,
  matchPlaybookRewriteGuidance,
  buildRewriteExpectation,
} from './rewrite-templates.js';

describe('rewrite templates (E4)', () => {
  const templates = loadRewriteTemplates();

  it('loads template library', () => {
    expect(templates.templates.length).toBeGreaterThanOrEqual(4);
  });

  it('passes when forbidden terms removed', () => {
    const expected = buildRewriteExpectation({
      strategy: 'qualify',
      template: templates.templates.find((t) => t.template_id === 'qualify-performance'),
    });
    const result = matchRewriteExpectation(
      'Typical results under normal conditions may vary.',
      expected,
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('fails when forbidden terms remain', () => {
    const expected = buildRewriteExpectation({
      strategy: 'qualify',
      template: templates.templates.find((t) => t.template_id === 'qualify-performance'),
    });
    const result = matchRewriteExpectation('Perfect results every time.', expected);
    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it('scores playbook guidance against rewrite template', () => {
    const template = templates.templates.find((t) => t.template_id === 'disclose-urgency')!;
    const expected = buildRewriteExpectation({ strategy: 'disclose', template });
    const result = matchPlaybookRewriteGuidance(
      'Limited time offer on wellness packs. #ad',
      'Urgency call-to-action detected. Add offer validity dates or remove pressure language.',
      expected,
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });
});
