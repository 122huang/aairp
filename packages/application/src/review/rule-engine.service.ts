import { randomUUID } from 'node:crypto';
import type {
  FindingCitation,
  ReviewContext,
  RuleEvaluationResult,
  RuleFinding,
  RuntimeRuleCountryDecisionOverride,
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

function isRuleLevelCountryOverride(
  override: RuntimeRuleCountryDecisionOverride | Record<string, RuntimeRuleCountryDecisionOverride>,
): override is RuntimeRuleCountryDecisionOverride {
  return 'decision' in override || 'severity' in override;
}

function normalizeRuleDecision(decision: string): RuleFinding['decision'] {
  if (decision === 'MANUAL_REVIEW') {
    return 'REVIEW';
  }
  return decision as RuleFinding['decision'];
}

function resolveRuleDecision(
  rule: RuntimeRuleDefinition,
  countryId: string,
  matchedTerm?: string,
): { severity: RuleFinding['severity']; decision: RuleFinding['decision'] } {
  const override = rule.country_decision_overrides?.[countryId];
  if (!override) {
    return {
      severity: rule.severity as RuleFinding['severity'],
      decision: normalizeRuleDecision(rule.decision),
    };
  }

  if (isRuleLevelCountryOverride(override)) {
    return {
      severity: (override.severity ?? rule.severity) as RuleFinding['severity'],
      decision: normalizeRuleDecision(override.decision ?? rule.decision),
    };
  }

  if (matchedTerm) {
    const termKey = Object.keys(override).find(
      (key) => key.toLowerCase() === matchedTerm.toLowerCase(),
    );
    const termOverride = termKey
      ? (override[termKey] as { decision?: string; severity?: string } | undefined)
      : undefined;
    if (termOverride && (termOverride.decision || termOverride.severity)) {
      return {
        severity: (termOverride.severity ?? rule.severity) as RuleFinding['severity'],
        decision: normalizeRuleDecision(termOverride.decision ?? rule.decision),
      };
    }
  }

  return {
    severity: rule.severity as RuleFinding['severity'],
    decision: normalizeRuleDecision(rule.decision),
  };
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

  if (rule.forbidden_terms?.length) {
    const forbiddenMatch = findTermMatch(fields, rule.forbidden_terms);
    if (forbiddenMatch) {
      const { severity, decision } = resolveRuleDecision(
        rule,
        context.dimensions.countryId,
        forbiddenMatch.term ?? forbiddenMatch.text,
      );
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
      const { severity, decision } = resolveRuleDecision(
        rule,
        context.dimensions.countryId,
        triggerMatch.term ?? triggerMatch.text,
      );
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

  if (rule.when && !matchesRuleWhen(context, rule.when, fields)) {
    return findings.length > 0 ? [findings[0]!] : [];
  }

  const { severity, decision } = resolveRuleDecision(rule, context.dimensions.countryId);

  if (rule.required_any_terms?.length) {
    if (!hasAnyTerm(fields, rule.required_any_terms)) {
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

  const hasPositiveMatcher =
    Boolean(rule.forbidden_terms?.length) ||
    Boolean(rule.trigger_terms?.length) ||
    Boolean(rule.required_any_terms?.length) ||
    Boolean(rule.sku_mismatch_check);

  if (
    findings.length === 0 &&
    rule.when &&
    !hasPositiveMatcher &&
    matchesRuleWhen(context, rule.when, fields)
  ) {
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

  return findings.length > 1 ? [findings[0]!] : findings;
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
