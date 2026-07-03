import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type DemoKnowledgePaths = {
  root: string;
  rulesJson: string;
  playbookMarkdown: string;
  openRiskPrompt: string;
};

export function resolveDemoKnowledgeRoot(customRoot?: string): string {
  if (customRoot) {
    return customRoot;
  }
  if (process.env.AAIRP_DEMO_ROOT) {
    return process.env.AAIRP_DEMO_ROOT;
  }
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../demo');
}

export function resolveDemoKnowledgePaths(customRoot?: string): DemoKnowledgePaths {
  const root = resolveDemoKnowledgeRoot(customRoot);
  return {
    root,
    rulesJson: join(root, 'rules.demo.json'),
    playbookMarkdown: join(root, 'playbook.demo.md'),
    openRiskPrompt: join(root, 'open-risk.prompt.txt'),
  };
}

export const DEMO_RULE_PACK_KEY = 'demo-rules';
export const DEMO_PLAYBOOK_PACK_KEY = 'demo-health-supplement-playbook';
export const DEMO_PROMPT_PACK_KEY = 'demo-open-risk';
export const DEMO_OPEN_RISK_TEMPLATE_KEY = 'open-risk-discovery';

export type DemoRegulationSeed = {
  regulationKey: string;
  jurisdiction: string;
  lawName: string;
  article?: string;
  bodyText?: string;
  tags?: string[];
  effectiveDate?: string;
  mandatory?: boolean;
  riskLevel?: string;
};

export const DEMO_REGULATION_SEEDS: DemoRegulationSeed[] = [
  {
    regulationKey: 'sg-hpa-s7',
    jurisdiction: 'SG',
    lawName: 'SG Health Products Act (Demo)',
    article: 'Section 7 — Prohibited claims',
    bodyText: 'Prohibited health claims including cure, miracle, and absolute efficacy statements.',
    tags: ['demo', 'health', 'sg'],
    effectiveDate: '2020-01-01',
    mandatory: true,
    riskLevel: 'HIGH',
  },
  {
    regulationKey: 'sg-asasa-substantiation',
    jurisdiction: 'SG',
    lawName: 'ASAS Code of Advertising Practice (Demo)',
    article: 'General Principle — Substantiation',
    bodyText: 'Advertisers must hold substantiation for comparative and superlative claims.',
    tags: ['demo', 'advertising', 'sg'],
    effectiveDate: '2019-06-01',
    mandatory: true,
    riskLevel: 'MEDIUM',
  },
  {
    regulationKey: 'sg-scap-disclosure',
    jurisdiction: 'SG',
    lawName: 'Singapore Code of Advertising Practice (Demo)',
    article: 'Rule 2 — Identification of Advertisements',
    bodyText: 'Sponsored content must be clearly identified as advertising.',
    tags: ['demo', 'disclosure', 'sg'],
    effectiveDate: '2021-03-15',
    mandatory: true,
    riskLevel: 'LOW',
  },
];
