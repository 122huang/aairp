import { readFile } from 'node:fs/promises';
import type {
  IKnowledgeGateway,
  RuntimeKnowledgeSnapshot,
  RuntimeRulePack,
} from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import {
  DEMO_OPEN_RISK_TEMPLATE_KEY,
  DEMO_PLAYBOOK_PACK_KEY,
  DEMO_PROMPT_PACK_KEY,
  DEMO_RULE_PACK_KEY,
  resolveDemoKnowledgePaths,
  type DemoKnowledgePaths,
} from './demo-knowledge-paths.js';

type DemoRulesFile = {
  pack_version: string;
  rules: RuntimeRulePack['rules'];
};

export type DemoKnowledgeGatewayConfig = {
  paths?: DemoKnowledgePaths;
  readText?: (path: string) => Promise<string>;
};

export class DemoKnowledgeGateway implements IKnowledgeGateway {
  constructor(private readonly config: DemoKnowledgeGatewayConfig = {}) {}

  async loadSnapshot(): Promise<RuntimeKnowledgeSnapshot> {
    const paths = this.config.paths ?? resolveDemoKnowledgePaths();
    const readText = this.config.readText ?? ((path: string) => readFile(path, 'utf8'));

    const rulesRaw = await readText(paths.rulesJson);
    const rulesFile = JSON.parse(rulesRaw) as DemoRulesFile;
    const playbookMarkdown = await readText(paths.playbookMarkdown);
    const openRiskContent = await readText(paths.openRiskPrompt);

    return {
      source: 'demo',
      versions: {
        ...DEMO_KNOWLEDGE_VERSIONS,
        rulePackVersion: rulesFile.pack_version,
      },
      rulePack: {
        pack_version: rulesFile.pack_version,
        rules: rulesFile.rules,
      },
      playbook: {
        pack_version: DEMO_KNOWLEDGE_VERSIONS.playbookPackVersion,
        playbook_id: DEMO_PLAYBOOK_PACK_KEY,
        markdown: playbookMarkdown,
      },
      openRiskPrompt: {
        pack_version: 'demo-open-risk-1.1.0',
        template_key: DEMO_OPEN_RISK_TEMPLATE_KEY,
        content: openRiskContent,
      },
    };
  }
}

export const DEMO_KNOWLEDGE_PACK_KEYS = {
  rulePackKey: DEMO_RULE_PACK_KEY,
  playbookPackKey: DEMO_PLAYBOOK_PACK_KEY,
  promptPackKey: DEMO_PROMPT_PACK_KEY,
  openRiskTemplateKey: DEMO_OPEN_RISK_TEMPLATE_KEY,
} as const;
