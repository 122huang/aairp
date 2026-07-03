import type { PackVersionStatus, PaginatedResult, PaginationParams } from './common.js';

export type RulePack = {
  rulePackId: string;
  packKey: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type RuleDefinition = {
  ruleId: string;
  rulePackId: string;
  ruleKey: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
};

export type RuleScope = {
  countries: string[];
  categories: string[];
};

export type RuleVersion = {
  ruleVersionId: string;
  ruleId: string;
  versionNumber: number;
  status: PackVersionStatus;
  severity: string;
  decision: string;
  summary: string;
  scope: RuleScope;
  payload: Record<string, unknown>;
  owner?: string;
  ownerType?: string;
  lastReviewedAt?: string;
  freshnessStatus?: string;
  tags: string[];
  effectiveFrom?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateRulePackInput = {
  packKey: string;
  name: string;
  description?: string;
};

export type CreateRuleInput = {
  rulePackId: string;
  ruleKey: string;
  displayName?: string;
};

export type CreateRuleVersionInput = {
  ruleId: string;
  severity: string;
  decision: string;
  summary: string;
  scope: RuleScope;
  payload: Record<string, unknown>;
  owner?: string;
  ownerType?: string;
  lastReviewedAt?: string;
  freshnessStatus?: string;
  tags?: string[];
};

export type UpdateRuleVersionInput = {
  severity?: string;
  decision?: string;
  summary?: string;
  scope?: RuleScope;
  payload?: Record<string, unknown>;
  owner?: string;
  tags?: string[];
};

export type RuleExportEntry = {
  rule_id: string;
  rule_version_id: string;
  severity: string;
  decision: string;
  summary: string;
  scopes: RuleScope;
  forbidden_terms?: string[];
  trigger_terms?: string[];
  required_any_terms?: string[];
  citation?: { law_name: string; article?: string };
  regulation_version_ids: string[];
};

export type RulePackExportBundle = {
  pack_key: string;
  pack_version: string;
  rules: RuleExportEntry[];
};

export type IRuleRepository = {
  listPacks(params: PaginationParams): Promise<PaginatedResult<RulePack>>;
  createPack(input: CreateRulePackInput): Promise<RulePack>;
  getPackById(rulePackId: string): Promise<RulePack | null>;
  getPackByKey(packKey: string): Promise<RulePack | null>;
  listRules(rulePackId: string, params: PaginationParams): Promise<PaginatedResult<RuleDefinition>>;
  createRule(input: CreateRuleInput): Promise<RuleDefinition>;
  getRuleById(ruleId: string): Promise<RuleDefinition | null>;
  getRuleByPackAndKey(rulePackId: string, ruleKey: string): Promise<RuleDefinition | null>;
  listVersions(ruleId: string, status?: PackVersionStatus): Promise<RuleVersion[]>;
  createVersion(input: CreateRuleVersionInput): Promise<RuleVersion>;
  getVersionById(ruleVersionId: string): Promise<RuleVersion | null>;
  updateVersion(ruleVersionId: string, input: UpdateRuleVersionInput): Promise<RuleVersion>;
  listRegulationVersionIds(ruleVersionId: string): Promise<string[]>;
  setRegulationVersionLinks(ruleVersionId: string, regulationVersionIds: string[]): Promise<void>;
  exportPack(rulePackId: string): Promise<RulePackExportBundle | null>;
};
