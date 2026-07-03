import { randomUUID } from 'node:crypto';
import type {
  FindingCitation,
  ReviewContext,
  RuleEvaluationResult,
  RuleFinding,
  RuntimeRuleDefinition,
  RuntimeRulePack,
} from '@aairp/shared-kernel';
import { loadDemoRulePackSync } from '../knowledge/load-demo-rule-pack.js';
import { findTermMatch, hasAnyTerm, searchableFields } from './content-matching.js';
import { findSkuMismatchToken, matchesRuleWhen } from './modality-rules.js';

export type RuleEngineConfig = {
  now?: () => Date;
  createFindingId?: () => string;
  rulePack?: RuntimeRulePack;
};

type RuleScope = {
  countries: string[];
  categories: string[];
};

function matchesScope(context: ReviewContext, scope: RuleScope): boolean {
  return (
    scope.countries.includes(context.dimensions.countryId) &&
    scope.categories.includes(context.dimensions.categoryId)
  );
}

function createRuleFinding(
  config: RuleEngineConfig,
  params: {
    ruleId: string;
    ruleVersionId: string;
    severity: RuleFinding['severity'];
    decision: RuleFinding['decision'];
    summary: string;
    matchedSpan?: { field: string; start: number; end: number; text: string };
    citation?: FindingCitation;
  },
): RuleFinding {
  const findingId = `rf_${(config.createFindingId ?? randomUUID)()}`;
  const evaluationDetail =
    params.matchedSpan || params.citation
      ? {
          ...(params.matchedSpan ? { matchedSpans: [params.matchedSpan] } : {}),
          ...(params.citation ? { citation: params.citation } : {}),
        }
      : undefined;

  return {
    module: 'RULE',
    findingId,
    severity: params.severity,
    decision: params.decision,
    refType: 'RULE',
    refId: params.ruleId,
    refVersionId: params.ruleVersionId,
    summary: params.summary,
    confidence: 1,
    ...(evaluationDetail ? { evaluationDetail } : {}),
  };
}

function evaluateRuleDefinition(
  config: RuleEngineConfig,
  context: ReviewContext,
  rule: RuntimeRuleDefinition,
  fields: ReturnType<typeof searchableFields>,
): RuleFinding[] {
  if (!matchesScope(context, rule.scopes)) {
    return [];
  }

  const findings: RuleFinding[] = [];
  const severity = rule.severity as RuleFinding['severity'];
  const decision = rule.decision as RuleFinding['decision'];

  if (rule.forbidden_terms?.length) {
    const forbiddenMatch = findTermMatch(fields, rule.forbidden_terms);
    if (forbiddenMatch) {
      findings.push(
        createRuleFinding(config, {
          ruleId: rule.rule_id,
          ruleVersionId: rule.rule_version_id,
          severity,
          decision,
          summary: rule.summary,
          matchedSpan: forbiddenMatch,
          citation: rule.citation,
        }),
      );
    }
  }

  if (rule.trigger_terms?.length) {
    const triggerMatch = findTermMatch(fields, rule.trigger_terms);
    if (triggerMatch) {
      findings.push(
        createRuleFinding(config, {
          ruleId: rule.rule_id,
          ruleVersionId: rule.rule_version_id,
          severity,
          decision,
          summary: rule.summary,
          matchedSpan: triggerMatch,
          citation: rule.citation,
        }),
      );
    }
  }

  if (rule.required_any_terms?.length) {
    const applies = rule.when ? matchesRuleWhen(context, rule.when) : true;
    if (applies && !hasAnyTerm(fields, rule.required_any_terms)) {
      findings.push(
        createRuleFinding(config, {
          ruleId: rule.rule_id,
          ruleVersionId: rule.rule_version_id,
          severity,
          decision,
          summary: rule.summary,
          citation: rule.citation,
        }),
      );
    }
  }

  if (rule.sku_mismatch_check) {
    const expectedSku = context.advertisementContext.productSku?.trim();
    if (expectedSku) {
      const mismatchToken = findSkuMismatchToken(expectedSku, fields);
      if (mismatchToken) {
        findings.push(
          createRuleFinding(config, {
            ruleId: rule.rule_id,
            ruleVersionId: rule.rule_version_id,
            severity,
            decision,
            summary: rule.summary,
            matchedSpan: {
              field: 'text',
              start: 0,
              end: mismatchToken.length,
              text: mismatchToken,
            },
            citation: rule.citation,
          }),
        );
      }
    }
  }

  return findings;
}

export class RuleEngineService {
  constructor(private readonly config: RuleEngineConfig = {}) {}

  evaluate(context: ReviewContext): RuleEvaluationResult {
    const rulePack = this.config.rulePack ?? loadDemoRulePackSync();
    const findings = this.evaluateFromRulePack(context, rulePack);

    const evaluatedAt = (this.config.now ?? (() => new Date()))().toISOString();

    return {
      reviewId: context.reviewId,
      rulePackVersion: rulePack.pack_version,
      findings,
      hasBlocker: findings.some(
        (finding) => finding.severity === 'BLOCKER' && finding.decision === 'FAIL',
      ),
      evaluatedAt,
    };
  }

  private evaluateFromRulePack(context: ReviewContext, rulePack: RuntimeRulePack): RuleFinding[] {
    const fields = searchableFields(context);
    return rulePack.rules.flatMap((rule) =>
      evaluateRuleDefinition(this.config, context, rule, fields),
    );
  }
}
