import type { RuleDefinition, RulePack, RulePackExportBundle, RuleVersion } from '@aairp/shared-kernel';

export type RulePackDto = {
  rule_pack_id: string;
  pack_key: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
};

export type RuleDefinitionDto = {
  rule_id: string;
  rule_pack_id: string;
  rule_key: string;
  display_name?: string;
  created_at: string;
  updated_at: string;
};

export type RuleVersionDto = {
  rule_version_id: string;
  rule_id: string;
  version_number: number;
  status: string;
  severity: string;
  decision: string;
  summary: string;
  scope: { countries: string[]; categories: string[] };
  payload: Record<string, unknown>;
  owner?: string;
  tags: string[];
  effective_from?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  regulation_version_ids?: string[];
};

export function toRulePackDto(pack: RulePack): RulePackDto {
  return {
    rule_pack_id: pack.rulePackId,
    pack_key: pack.packKey,
    name: pack.name,
    description: pack.description,
    created_at: pack.createdAt,
    updated_at: pack.updatedAt,
  };
}

export function toRuleDefinitionDto(rule: RuleDefinition): RuleDefinitionDto {
  return {
    rule_id: rule.ruleId,
    rule_pack_id: rule.rulePackId,
    rule_key: rule.ruleKey,
    display_name: rule.displayName,
    created_at: rule.createdAt,
    updated_at: rule.updatedAt,
  };
}

export function toRuleVersionDto(
  version: RuleVersion,
  regulationVersionIds?: string[],
): RuleVersionDto {
  return {
    rule_version_id: version.ruleVersionId,
    rule_id: version.ruleId,
    version_number: version.versionNumber,
    status: version.status,
    severity: version.severity,
    decision: version.decision,
    summary: version.summary,
    scope: version.scope,
    payload: version.payload,
    owner: version.owner,
    tags: version.tags,
    effective_from: version.effectiveFrom,
    published_at: version.publishedAt,
    created_at: version.createdAt,
    updated_at: version.updatedAt,
    ...(regulationVersionIds ? { regulation_version_ids: regulationVersionIds } : {}),
  };
}

export function toRulePackExportDto(bundle: RulePackExportBundle) {
  return bundle;
}
