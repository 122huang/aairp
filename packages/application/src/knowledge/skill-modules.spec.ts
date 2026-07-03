import { describe, expect, it } from 'vitest';
import { loadSkillModules, listModulePatternIds } from './skill-modules.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePlaybookMarkdown } from '../review/playbook-engine.service.js';

describe('Skill Modules (E1)', () => {
  const doc = loadSkillModules();
  const playbookPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../demo/playbook.demo.md',
  );
  const playbook = parsePlaybookMarkdown(readFileSync(playbookPath, 'utf8'));

  it('has ownership on every module', () => {
    for (const mod of doc.modules) {
      expect(mod.owner).toBeTruthy();
      expect(mod.owner_type).toBeTruthy();
      expect(mod.freshness_status).toBeTruthy();
      expect(mod.activation_conditions).toBeDefined();
      expect(mod.applicable_rules.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('maps all playbook patterns', () => {
    const patternIds = new Set(listModulePatternIds(doc));
    for (const item of playbook.items) {
      expect(patternIds.has(item.patternId), item.patternId).toBe(true);
    }
  });

  it('maps all golden issues', () => {
    const goldenPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../scripts/golden-benchmark-v1-cases.json',
    );
    const issues = [
      ...new Set(
        (JSON.parse(readFileSync(goldenPath, 'utf8')) as Array<{ issue: string }>).map((c) => c.issue),
      ),
    ];
    for (const issue of issues) {
      expect(doc.golden_issue_map[issue], issue).toBeDefined();
    }
  });
});
