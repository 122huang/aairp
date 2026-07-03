import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type LinkageRuleExclusion = {
  exclude_from_strict_linkage: boolean;
  exclude_reason: string;
};

export type LinkageLegacyPattern = {
  legacy_pattern: boolean;
};

export type LinkageValidatorConfig = {
  schema_version: string;
  description?: string;
  rules_excluded_from_strict_linkage: Record<string, LinkageRuleExclusion>;
  legacy_patterns: Record<string, LinkageLegacyPattern>;
};

const defaultConfigRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/knowledge',
);

export function resolveLinkageValidatorConfigPath(customRoot?: string): string {
  return join(customRoot ?? defaultConfigRoot, 'linkage-validator.config.json');
}

export function loadLinkageValidatorConfig(customRoot?: string): LinkageValidatorConfig {
  const configPath = resolveLinkageValidatorConfigPath(customRoot);
  if (!existsSync(configPath)) {
    return {
      schema_version: '1.0.0',
      rules_excluded_from_strict_linkage: {},
      legacy_patterns: {},
    };
  }
  return JSON.parse(readFileSync(configPath, 'utf8')) as LinkageValidatorConfig;
}

export function isRuleExcludedFromStrictLinkage(
  ruleId: string,
  config: LinkageValidatorConfig,
): boolean {
  return config.rules_excluded_from_strict_linkage[ruleId]?.exclude_from_strict_linkage === true;
}

export function isLegacyPattern(patternId: string, config: LinkageValidatorConfig): boolean {
  return config.legacy_patterns[patternId]?.legacy_pattern === true;
}
