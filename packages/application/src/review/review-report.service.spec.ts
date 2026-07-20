import { describe, expect, it } from 'vitest';
import type { ReviewContext } from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from './context-builder.service.js';
import { ReviewReportService } from './review-report.service.js';

const baseContext: ReviewContext = {
  reviewId: 'rev_test',
  advertisementId: 'ad_test',
  contentHash: 'hash123',
  contentVersion: 1,
  dimensions: {
    tenantId: 'demo',
    countryId: 'SG',
    platformId: 'META',
    categoryId: 'health.supplement',
  },
  normalizedContent: {
    text: 'Clinically proven to cure diabetes in 7 days. Buy now!',
    imageUrls: [],
  },
  resolvedKnowledgeVersions: DEMO_KNOWLEDGE_VERSIONS,
  advertisementContext: {},
  tags: [],
  builtAt: '2026-06-26T10:05:00.000Z',
};

const fixedDate = new Date('2026-06-26T10:10:00.000Z');

describe('ReviewReportService', () => {
  it('renders HTML with decision, advertisement summary, and findings', () => {
    const service = new ReviewReportService({ now: () => fixedDate });

    const result = service.render({
      context: baseContext,
      decision: {
        reviewId: 'rev_test',
        finalDecision: 'REJECT',
        confidence: 1,
        rationale: 'Rule BLOCKER finding requires rejection.',
        findingCounts: { rule: 1, playbook: 1, llm: 0 },
        decidedAt: '2026-06-26T10:09:00.000Z',
      },
      ruleFindings: [
        {
          module: 'RULE',
          findingId: 'rf_blocker',
          severity: 'BLOCKER',
          decision: 'FAIL',
          refType: 'RULE',
          refId: 'demo-sg-health-forbidden-claim',
          refVersionId: 'demo-sg-health-forbidden-claim-v1',
          summary: 'Forbidden health cure claim',
          confidence: 1,
        },
      ],
      playbookFindings: [
        {
          module: 'PLAYBOOK',
          findingId: 'pf_warn',
          severity: 'MEDIUM',
          decision: 'WARN',
          refType: 'PLAYBOOK_PATTERN',
          refId: 'urgency-cta',
          refVersionId: 'urgency-cta-v1',
          summary: 'Urgency call-to-action detected',
          confidence: 0.8,
        },
      ],
      openRiskResult: {
        skipped: true,
        skipReason: 'HAS_BLOCKER',
        findings: [],
      },
    });

    expect(result.reviewId).toBe('rev_test');
    expect(result.generatedAt).toBe('2026-06-26T10:10:00.000Z');
    expect(result.summary.finalDecision).toBe('REJECT');
    expect(result.summary.findings).toHaveLength(2);
    expect(result.reportHtml).toContain('decision-reject');
    expect(result.reportHtml).toContain('Rule Findings');
    expect(result.reportHtml).toContain('Playbook Findings');
    expect(result.reportHtml).toContain('demo-sg-health-forbidden-claim');
    expect(result.reportHtml).toContain('urgency-cta');
    expect(result.reportHtml).toContain('HAS_BLOCKER');
    expect(result.reportHtml).toContain('Clinically proven to cure diabetes');
    expect(result.reportHtml).toContain('REJECT');
    expect(result.reportHtml).not.toContain('Confidence:');
  });

  it('renders rewrite suggestions under each WARN finding detail', () => {
    const service = new ReviewReportService({ now: () => fixedDate });

    const result = service.render({
      context: baseContext,
      decision: {
        reviewId: 'rev_test',
        finalDecision: 'WARN',
        confidence: 0.82,
        rationale: 'Health implication warning.',
        findingCounts: { rule: 1, playbook: 0, llm: 0, case: 0, vision: 0 },
        decidedAt: '2026-06-26T10:09:00.000Z',
      },
      ruleFindings: [
        {
          module: 'RULE',
          findingId: 'rf_health',
          severity: 'MEDIUM',
          decision: 'WARN',
          refType: 'RULE',
          refId: 'demo-apac-sa-health-implication',
          refVersionId: 'demo-apac-sa-health-implication-v7',
          summary: 'Health implication detected',
          confidence: 1,
          evaluationDetail: {
            matchedSpans: [{ field: 'text', start: 0, end: 4, text: '更轻盈' }],
          },
        },
      ],
      playbookFindings: [],
      openRiskResult: {
        skipped: false,
        findings: [],
      },
      contextualRewrites: {
        mode: 'stub',
        rewriteMs: 3,
        results: [
          {
            reviewId: 'rev_test',
            findingId: 'rf_health',
            riskType: 'health-implication',
            skipped: false,
            suggestion: {
              suggestionId: 'rs_test',
              findingId: 'rf_health',
              riskType: 'health-implication',
              rewriteTemplateId: 'remove-health-claim',
              originalSpan: { field: 'text', start: 0, end: 4, text: '更轻盈' },
              suggestedText: ['热风循环技术，无需预热，即放即炸。'],
              rationale: '以功能描述替代健康联想措辞。',
              confidence: 0.82,
            },
          },
        ],
      },
    });

    expect(result.summary.findings[0]?.rewriteSuggestions).toHaveLength(1);
    expect(result.reportHtml).toContain('finding-detail');
    expect(result.reportHtml).toContain('修改建议');
    expect(result.reportHtml).toContain('热风循环技术，无需预热，即放即炸。');
    expect(result.reportHtml.indexOf('demo-apac-sa-health-implication')).toBeLessThan(
      result.reportHtml.indexOf('修改建议'),
    );
    expect(result.reportHtml).not.toContain('<h2>修改建议</h2>');
  });

  it('escapes HTML in advertisement text and finding summaries', () => {
    const service = new ReviewReportService({ now: () => fixedDate });

    const result = service.render({
      context: {
        ...baseContext,
        normalizedContent: {
          text: '<script>alert("x")</script>',
          imageUrls: [],
        },
      },
      decision: {
        reviewId: 'rev_test',
        finalDecision: 'PASS',
        confidence: 0.95,
        rationale: 'No blocking or warning findings.',
        findingCounts: { rule: 0, playbook: 0, llm: 0 },
        decidedAt: '2026-06-26T10:09:00.000Z',
      },
      ruleFindings: [],
      playbookFindings: [],
      openRiskResult: {
        skipped: false,
        findings: [],
      },
    });

    expect(result.reportHtml).not.toContain('<script>alert');
    expect(result.reportHtml).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });

  it('shows empty findings row when no findings exist', () => {
    const service = new ReviewReportService({ now: () => fixedDate });

    const result = service.render({
      context: baseContext,
      decision: {
        reviewId: 'rev_test',
        finalDecision: 'PASS',
        confidence: 0.95,
        rationale: 'No blocking or warning findings.',
        findingCounts: { rule: 0, playbook: 0, llm: 0 },
        decidedAt: '2026-06-26T10:09:00.000Z',
      },
      ruleFindings: [],
      playbookFindings: [],
      openRiskResult: {
        skipped: false,
        findings: [],
      },
    });

    expect(result.reportHtml).toContain('decision-pass');
    expect(result.reportHtml).toContain('Rule Findings');
    expect(result.summary.findings).toEqual([]);
  });

  it('resolves EVIDENCE_SUPPLEMENT for LLM comparative-claim via risk_type whitelist', () => {
    const service = new ReviewReportService({ now: () => fixedDate });

    const result = service.render({
      context: baseContext,
      decision: {
        reviewId: 'rev_test',
        finalDecision: 'REVIEW',
        confidence: 0.7,
        rationale: 'Open-risk comparative claim needs evidence.',
        findingCounts: { rule: 0, playbook: 0, llm: 1 },
        decidedAt: '2026-06-26T10:09:00.000Z',
      },
      ruleFindings: [],
      playbookFindings: [],
      openRiskResult: {
        skipped: false,
        findings: [
          {
            module: 'LLM',
            findingId: 'lf_comp',
            severity: 'MEDIUM',
            decision: 'REVIEW',
            refType: 'LLM_RISK',
            refId: 'unsupported-comparative-claim',
            refVersionId: 'open-risk-v1',
            summary: 'Unsupported comparative claim',
            confidence: 0.72,
            evaluationDetail: {
              riskType: 'unsupported-comparative-claim',
              suggestedAction: 'MANUAL_REVIEW',
            },
          },
        ],
      },
    });

    expect(result.summary.findings).toHaveLength(1);
    expect(result.summary.findings[0]?.remediationType).toBe('EVIDENCE_SUPPLEMENT');
  });

  it('resolves EVIDENCE_SUPPLEMENT for playbook sa-comparative-claim via pattern id', () => {
    const service = new ReviewReportService({ now: () => fixedDate });

    const result = service.render({
      context: baseContext,
      decision: {
        reviewId: 'rev_test',
        finalDecision: 'WARN',
        confidence: 0.8,
        rationale: 'Playbook comparative pattern.',
        findingCounts: { rule: 0, playbook: 1, llm: 0 },
        decidedAt: '2026-06-26T10:09:00.000Z',
      },
      ruleFindings: [],
      playbookFindings: [
        {
          module: 'PLAYBOOK',
          findingId: 'pf_comp',
          severity: 'MEDIUM',
          decision: 'WARN',
          refType: 'PLAYBOOK_PATTERN',
          refId: 'sa-comparative-claim',
          refVersionId: 'sa-comparative-claim-v1',
          summary: 'Comparative claim pattern',
          confidence: 0.8,
          evaluationDetail: {
            patternId: 'sa-comparative-claim',
            checklistIds: [],
            guidance: 'Require substantiation or rewrite.',
            severityHint: 'MEDIUM',
            playbookDecision: 'WARN',
            typicalDecision: 'REVIEW',
          },
        },
      ],
      openRiskResult: {
        skipped: true,
        skipReason: 'HAS_BLOCKER',
        findings: [],
      },
    });

    expect(result.summary.findings[0]?.remediationType).toBe('EVIDENCE_SUPPLEMENT');
  });
});
