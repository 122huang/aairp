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
        matchType: item.matchMode === 'link' ? 'link' : 'terms',
        terms: item.triggerKeywords.length > 0 ? item.triggerKeywords : item.linkedRules,
        guidance: item.guidance,
        markdownBody: [
          `severity_hint: ${item.severityHint}`,
          `decision: ${item.playbookDecision}`,
          `typical_decision: ${item.typicalDecision}`,
          ...(item.matchMode === 'link'
            ? [`match_mode: link`, `linked_rules: ${item.linkedRules.join(', ')}`]
            : []),
          ...(item.triggerKeywords.length > 0
            ? [`trigger_keywords: ${item.triggerKeywords.join(', ')}`]
            : []),
        ].join('\n'),
        createdAt: '2026-06-26T10:00:00.000Z',
        updatedAt: '2026-06-26T10:00:00.000Z',
      })),
    });

    const roundTrip = parsePlaybookMarkdown(rendered);
    expect(roundTrip.packVersion).toBe(parsed.packVersion);
    expect(roundTrip.playbookId).toBe(parsed.playbookId);
    expect(roundTrip.items).toHaveLength(parsed.items.length);
    expect(roundTrip.items.map((item) => item.patternId)).toEqual(
      parsed.items.map((item) => item.patternId),
    );
  });

  it('coerces illegal playbook decision FAIL to WARN', () => {
    const parsed = parsePlaybookMarkdown(`# T
pack_version: t
playbook_id: t

## sample
trigger_keywords: foo
decision: FAIL
guidance: g
typical_decision: REJECT
`);
    expect(parsed.items[0]!.playbookDecision).toBe('WARN');
  });

  it('keeps link-mode patterns without trigger keywords', () => {
    const parsed = parsePlaybookMarkdown(`# T
pack_version: t
playbook_id: t

## linked-only
match_mode: link
linked_rules: demo-apac-sa-social-proof-claim
decision: WARN
guidance: attach when rule hits
typical_decision: REVIEW
`);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]!.matchMode).toBe('link');
    expect(parsed.items[0]!.linkedRules).toEqual(['demo-apac-sa-social-proof-claim']);
    expect(parsed.items[0]!.triggerKeywords).toEqual([]);
  });
});
