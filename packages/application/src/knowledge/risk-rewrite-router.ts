import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RISK_REWRITE_STRATEGIES = [
  'remove',
  'qualify',
  'substantiate',
  'rephrase',
  'append',
] as const;

export type RiskRewriteStrategy = (typeof RISK_REWRITE_STRATEGIES)[number];

export type RiskRewriteRoute = {
  risk_type: string;
  rewrite_template_id: string;
  strategy: RiskRewriteStrategy;
  rule_ids?: string[];
};

export type RiskRewriteRoutesDocument = {
  schema_version: string;
  routes_version: string;
  description: string;
  source_taxonomy?: string;
  strategy_definitions: Record<RiskRewriteStrategy, string>;
  routes: RiskRewriteRoute[];
};

const defaultRoutesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/knowledge/risk-rewrite-routes.json',
);

export function resolveRiskRewriteRoutesPath(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  if (process.env.AAIRP_RISK_REWRITE_ROUTES_PATH) {
    return process.env.AAIRP_RISK_REWRITE_ROUTES_PATH;
  }
  return defaultRoutesPath;
}

export function loadRiskRewriteRoutes(customPath?: string): RiskRewriteRoutesDocument {
  const path = resolveRiskRewriteRoutesPath(customPath);
  return JSON.parse(readFileSync(path, 'utf8')) as RiskRewriteRoutesDocument;
}

export function buildRiskRewriteRouteIndex(
  doc: RiskRewriteRoutesDocument,
): Map<string, RiskRewriteRoute> {
  return new Map(doc.routes.map((route) => [route.risk_type, route]));
}

export function buildRuleIdToRiskTypeIndex(
  doc: RiskRewriteRoutesDocument,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const route of doc.routes) {
    for (const ruleId of route.rule_ids ?? []) {
      index.set(ruleId, route.risk_type);
    }
  }
  return index;
}

export function resolveRewriteTemplateId(
  riskType: string,
  routes: Map<string, RiskRewriteRoute>,
): string | undefined {
  return routes.get(riskType)?.rewrite_template_id;
}

export function listWarnRiskTypes(doc: RiskRewriteRoutesDocument): string[] {
  return doc.routes.map((route) => route.risk_type);
}
