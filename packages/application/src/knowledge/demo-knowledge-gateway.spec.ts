import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import { DemoKnowledgeGateway } from './demo-knowledge-gateway.js';

const demoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../demo');

describe('DemoKnowledgeGateway', () => {
  it('loads demo rule, playbook, and prompt snapshot', async () => {
    const gateway = new DemoKnowledgeGateway({
      paths: {
        root: demoRoot,
        rulesJson: join(demoRoot, 'rules.demo.json'),
        playbookMarkdown: join(demoRoot, 'playbook.demo.md'),
        openRiskPrompt: join(demoRoot, 'open-risk.prompt.txt'),
      },
    });

    const snapshot = await gateway.loadSnapshot();

    expect(snapshot.source).toBe('demo');
    expect(snapshot.versions.rulePackVersion).toBe(DEMO_KNOWLEDGE_VERSIONS.rulePackVersion);
    expect(snapshot.rulePack.rules).toHaveLength(74);
    expect(snapshot.playbook.markdown).toContain('playbook_id:');
    expect(snapshot.openRiskPrompt.content.length).toBeGreaterThan(100);
  });

  it('matches rules.demo.json pack_version', async () => {
    const asset = JSON.parse(
      readFileSync(join(demoRoot, 'rules.demo.json'), 'utf8'),
    ) as { pack_version: string };

    const snapshot = await new DemoKnowledgeGateway().loadSnapshot();
    expect(snapshot.rulePack.pack_version).toBe(asset.pack_version);
  });
});
