import { randomUUID } from 'node:crypto';
import type {
  FindingCitation,
  ReviewContext,
  RuleEvaluationResult,
  RuleFinding,
  RuntimeRuleDefinition,
  RuntimeRulePack,
} from '@aairp/shared-kernel';
import { findTermMatch, hasAnyTerm, searchableFields } from './content-matching.js';

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

  if (rule.required_any_terms?.length && !hasAnyTerm(fields, rule.required_any_terms)) {
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

  return findings;
}

export class RuleEngineService {
  constructor(private readonly config: RuleEngineConfig = {}) {}

  evaluate(context: ReviewContext): RuleEvaluationResult {
    const findings = this.config.rulePack
      ? this.evaluateFromRulePack(context, this.config.rulePack)
      : this.evaluateHardcoded(context);

    const evaluatedAt = (this.config.now ?? (() => new Date()))().toISOString();
    const rulePackVersion = this.config.rulePack?.pack_version
      ?? context.resolvedKnowledgeVersions.rulePackVersion;

    return {
      reviewId: context.reviewId,
      rulePackVersion,
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

  // Default path when AAIRP_KNOWLEDGE_SOURCE=demo and no injected rulePack.
  private evaluateHardcoded(context: ReviewContext): RuleFinding[] {
    const fields = searchableFields(context);
    const findings: RuleFinding[] = [];

    if (matchesScope(context, { countries: ['SG'], categories: ['health.supplement'] })) {
      const forbiddenMatch = findTermMatch(fields, [
        '100% cure',
        '100% effective',
        'cure',
        'miracle',
      ]);
      if (forbiddenMatch) {
        findings.push(
          createRuleFinding(this.config, {
            ruleId: 'demo-sg-health-forbidden-claim',
            ruleVersionId: 'demo-sg-health-forbidden-claim-v1',
            severity: 'BLOCKER',
            decision: 'FAIL',
            summary: 'Prohibited absolute health cure claims are not allowed',
            matchedSpan: forbiddenMatch,
            citation: {
              lawName: 'SG Health Products Act (Demo)',
              article: 'Section 7 — Prohibited claims',
            },
          }),
        );
      }

      const superlativeMatch = findTermMatch(fields, [
        'clinically proven',
        'guaranteed',
        '100%',
        'instant results',
      ]);
      if (superlativeMatch) {
        findings.push(
          createRuleFinding(this.config, {
            ruleId: 'demo-sg-health-superlative',
            ruleVersionId: 'demo-sg-health-superlative-v1',
            severity: 'MEDIUM',
            decision: 'WARN',
            summary:
              'Unsubstantiated superlative or efficacy claims require substantiation',
            matchedSpan: superlativeMatch,
          }),
        );
      }

      const disclosureTerms = ['#ad', 'sponsored', 'advertisement', '广告'];
      if (!hasAnyTerm(fields, disclosureTerms)) {
        findings.push(
          createRuleFinding(this.config, {
            ruleId: 'demo-sg-sponsored-disclosure',
            ruleVersionId: 'demo-sg-sponsored-disclosure-v1',
            severity: 'LOW',
            decision: 'WARN',
            summary: 'Sponsored or promotional content should include an ad disclosure',
          }),
        );
      }
    }

    return findings;
  }
}
