import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePlaybookMarkdown } from '../review/playbook-engine.service.js';
import { loadSkillTaxonomy, patternIdToModule } from './skill-taxonomy.js';

const demoPlaybookPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/playbook.demo.md',
);

describe('Playbook Skill metadata (E2)', () => {
  const parsed = parsePlaybookMarkdown(readFileSync(demoPlaybookPath, 'utf8'));
  const taxonomy = loadSkillTaxonomy();
  const moduleByPattern = patternIdToModule(taxonomy);

  it('parses skill_module on every pattern after backfill', () => {
    expect(parsed.packVersion).toBe('demo-playbook-1.6.1');
    for (const item of parsed.items) {
      expect(item.skillModule, `${item.patternId} missing skill_module`).toBeTruthy();
      expect(item.purpose, `${item.patternId} missing purpose`).toBeTruthy();
      expect(item.suggestedRewrite, `${item.patternId} missing suggested_rewrite`).toBeTruthy();
      expect(item.expectedSeverity, `${item.patternId} missing expected_severity`).toBeTruthy();
      expect(item.skillModule).toBe(moduleByPattern.get(item.patternId));
    }
  });

  it('does not change pattern count or trigger keywords', () => {
    expect(parsed.items).toHaveLength(31);
    const urgency = parsed.items.find((item) => item.patternId === 'urgency-cta');
    expect(urgency?.triggerKeywords).toContain('buy now');
  });
});
