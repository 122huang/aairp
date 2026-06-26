import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderPlaybookMarkdown } from '@aairp/shared-kernel';
import { parsePlaybookMarkdown } from '../review/playbook-engine.service.js';

const demoPlaybookPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/playbook.demo.md',
);

describe('playbook markdown export', () => {
  it('round-trips demo playbook pattern fields', () => {
    const source = readFileSync(demoPlaybookPath, 'utf8');
    const parsed = parsePlaybookMarkdown(source);
    const rendered = renderPlaybookMarkdown({
      title: 'Health Supplement Review Playbook (Demo)',
      packKey: parsed.playbookId,
      packVersion: parsed.packVersion,
      patterns: parsed.items.map((item) => ({
        patternId: 'ignored',
        playbookVersionId: 'ignored',
        refId: item.patternId,
        matchType: 'terms',
        terms: item.triggerKeywords,
        guidance: item.guidance,
        markdownBody: [
          `severity_hint: ${item.severityHint}`,
          `decision: ${item.playbookDecision}`,
          `typical_decision: ${item.typicalDecision}`,
        ].join('\n'),
        createdAt: '2026-06-26T10:00:00.000Z',
        updatedAt: '2026-06-26T10:00:00.000Z',
      })),
    });

    const roundTrip = parsePlaybookMarkdown(rendered);
    expect(roundTrip.packVersion).toBe(parsed.packVersion);
    expect(roundTrip.playbookId).toBe(parsed.playbookId);
    expect(roundTrip.items).toHaveLength(3);
    expect(roundTrip.items.map((item) => item.patternId)).toEqual(
      parsed.items.map((item) => item.patternId),
    );
  });
});
