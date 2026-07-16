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
import {
  findPatternMatch,
  findTermMatch,
  hasAnyTerm,
  searchableFields,
} from './content-matching.js';
import { detectReviewCopyLocale, pickLocalizedCopy } from './content-locale.js';
import { findSkuMismatchToken, matchesRuleWhen } from './modality-rules.js';

function resolveRuleSummary(rule: RuntimeRuleDefinition, adText: string): string {
  return pickLocalizedCopy(detectReviewCopyLocale(adText), {
    en: rule.summary_en,
    zh: rule.summary_zh,
    fallback: rule.summary,
  });
}

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
    remediationType?: RuleFinding['remediationType'];
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
    ...(params.remediationType ? { remediationType: params.remediationType } : {}),
    ...(evaluationDetail ? { evaluationDetail } : {}),
  };
}

function shouldEmitRequiredAnyFinding(
  rule: RuntimeRuleDefinition,
  context: ReviewContext,
  fields: ReturnType<typeof searchableFields>,
): boolean {
  const mode = rule.required_any_mode ?? 'always';
  if (mode === 'always') {
    return true;
  }

  const adType = (context.advertisementContext.adType ?? '').trim().toUpperCase();
  if (adType === 'INFLUENCER_UGC') {
    return true;
  }

  if (rule.activation_terms?.length) {
    return Boolean(findTermMatch(fields, rule.activation_terms));
  }

  return false;
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
  const localizedSummary = resolveRuleSummary(rule, context.normalizedContent.text ?? '');

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
          summary: localizedSummary,
          matchedSpan: forbiddenMatch,
          citation: rule.citation,
          remediationType: rule.remediation_type,
        }),
      );
    }
  }

  const triggerMatch =
    (rule.trigger_terms?.length ? findTermMatch(fields, rule.trigger_terms) : null) ??
    (rule.trigger_patterns?.length ? findPatternMatch(fields, rule.trigger_patterns) : null);

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
        summary: localizedSummary,
        matchedSpan: triggerMatch,
        citation: rule.citation,
        remediationType: rule.remediation_type,
      }),
    );
  }

  if (rule.when && !matchesRuleWhen(context, rule.when, fields)) {
    return findings.length > 0 ? [findings[0]!] : [];
  }

  const { severity, decision } = resolveRuleDecision(rule, context.dimensions.countryId);

  if (rule.required_any_mode === 'influencer_or_activation') {
    if (shouldEmitRequiredAnyFinding(rule, context, fields)) {
      // INFO reminders (sponsored-disclosure): fire for influencer/activation without
      // checking whether #ad / disclosure keywords are already present in copy.
      const requiredAnyTerms = rule.required_any_terms ?? [];
      // INFO reminders (sponsored-disclosure): fire for influencer/activation without
      // checking whether #ad / disclosure keywords are already present in copy.
      const skipDisclosurePresenceCheck = decision === 'INFO' || requiredAnyTerms.length === 0;
      const missingDisclosure =
        requiredAnyTerms.length > 0 && !hasAnyTerm(fields, requiredAnyTerms);
      if (skipDisclosurePresenceCheck || missingDisclosure) {
        findings.push(
          createRuleFinding(config, {
            ruleId: rule.rule_id,
            ruleVersionId: rule.rule_version_id,
            severity,
            decision,
            summary: localizedSummary,
            citation: rule.citation,
            remediationType: rule.remediation_type,
          }),
        );
      }
    }
  } else if (rule.required_any_terms?.length) {
    const missingRequired = !hasAnyTerm(fields, rule.required_any_terms);
    if (missingRequired && shouldEmitRequiredAnyFinding(rule, context, fields)) {
      findings.push(
        createRuleFinding(config, {
          ruleId: rule.rule_id,
          ruleVersionId: rule.rule_version_id,
          severity,
          decision,
          summary: localizedSummary,
          citation: rule.citation,
          remediationType: rule.remediation_type,
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
            summary: localizedSummary,
            matchedSpan: {
              field: 'text',
              start: 0,
              end: mismatchToken.length,
              text: mismatchToken,
            },
            citation: rule.citation,
            remediationType: rule.remediation_type,
          }),
        );
      }
    }
  }

  const hasPositiveMatcher =
    Boolean(rule.forbidden_terms?.length) ||
    Boolean(rule.trigger_terms?.length) ||
    Boolean(rule.required_any_terms?.length) ||
    Boolean(rule.activation_terms?.length) ||
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
        summary: localizedSummary,
        citation: rule.citation,
        remediationType: rule.remediation_type,
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
