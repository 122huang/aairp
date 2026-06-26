export type DemoRuleCitation = {
  law_name: string;
  article?: string;
};

export type DemoRuleEntry = {
  rule_id: string;
  rule_version_id: string;
  severity: string;
  decision: string;
  summary: string;
  forbidden_terms?: string[];
  trigger_terms?: string[];
  required_any_terms?: string[];
  scopes: {
    countries: string[];
    categories: string[];
  };
  citation?: DemoRuleCitation;
};

export type DemoRulesFile = {
  pack_version: string;
  rules: DemoRuleEntry[];
};

export type KosDemoImportAction = 'created' | 'skipped' | 'published';

export type KosDemoImportItemResult = {
  objectType: 'rule' | 'playbook' | 'prompt' | 'regulation';
  key: string;
  action: KosDemoImportAction;
  versionId?: string;
};

export type KosDemoImportResult = {
  regulations: KosDemoImportItemResult[];
  rules: KosDemoImportItemResult[];
  playbook: KosDemoImportItemResult;
  prompt: KosDemoImportItemResult;
};
