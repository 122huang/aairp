import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type {
  CaseReviewContext,
  PlaybookDecision,
  PlaybookEvaluationResult,
  PlaybookFinding,
  PlaybookSeverityHint,
  PlaybookTypicalDecision,
  ReviewContext,
} from '@aairp/shared-kernel';
import { findTermMatch, searchableFields } from './content-matching.js';

export type PlaybookEngineConfig = {
  playbookPath?: string;
  playbookMarkdown?: string;
  now?: () => Date;
  createFindingId?: () => string;
  readPlaybook?: (path: string) => string;
};

type ParsedPlaybookItem = {
  patternId: string;
  triggerKeywords: string[];
  linkedRules: string[];
  matchMode: 'terms' | 'link';
  severityHint: PlaybookSeverityHint;
  playbookDecision: PlaybookDecision;
  guidance: string;
  typicalDecision: PlaybookTypicalDecision;
  scopeCountries?: string[];
  scopeCategories?: string[];
  /** Sprint 3 metadata — not used by pattern matching. */
  skillModule?: string;
  purpose?: string;
  suggestedRewrite?: string;
  expectedSeverity?: string;
};

type ParsedPlaybook = {
  packVersion: string;
  playbookId: string;
  items: ParsedPlaybookItem[];
};

const PLAYBOOK_DECISIONS = new Set<PlaybookDecision>(['WARN', 'REVIEW', 'CONDITIONAL']);

function parsePlaybookDecision(raw: string | undefined): PlaybookDecision {
  const value = (raw ?? 'WARN').trim().toUpperCase();
  if (PLAYBOOK_DECISIONS.has(value as PlaybookDecision)) {
    return value as PlaybookDecision;
  }
  // Dirty data historically used FAIL; never let illegal values flow into findings.
  return 'WARN';
}

const defaultPlaybookPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/playbook.demo.md',
);

function parseFieldMap(sectionBody: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const line of sectionBody.split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key.length > 0 && value.length > 0) {
      fields[key] = value;
    }
  }

  return fields;
}

export function parsePlaybookMarkdown(content: string): ParsedPlaybook {
  const headerFields = parseFieldMap(content.split(/^## /m)[0] ?? '');
  const packVersion = headerFields.pack_version ?? 'demo-playbook-1.0.0';
  const playbookId = headerFields.playbook_id ?? 'demo-playbook';

  const items = content
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const lines = section.trim().split('\n');
      const patternId = lines[0]?.trim() ?? '';
      const fields = parseFieldMap(lines.slice(1).join('\n'));

      const triggerKeywords = (fields.trigger_keywords ?? '')
        .split(',')
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 0);
      const linkedRules = (fields.linked_rules ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      const matchModeRaw = (fields.match_mode ?? '').trim().toLowerCase();
      const matchMode: 'terms' | 'link' =
        matchModeRaw === 'link' || (triggerKeywords.length === 0 && linkedRules.length > 0)
          ? 'link'
          : 'terms';

      return {
        patternId,
        triggerKeywords,
        linkedRules,
        matchMode,
        severityHint: (fields.severity_hint ?? 'MEDIUM') as PlaybookSeverityHint,
        playbookDecision: parsePlaybookDecision(fields.decision),
        guidance: fields.guidance ?? '',
        typicalDecision: (fields.typical_decision ?? 'REVIEW') as PlaybookTypicalDecision,
        scopeCountries: fields.scope_countries
          ?.split(',')
          .map((value) => value.trim().toUpperCase())
          .filter((value) => value.length > 0),
        scopeCategories: fields.scope_categories
          ?.split(',')
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.length > 0),
        skillModule: fields.skill_module,
        purpose: fields.purpose,
        suggestedRewrite: fields.suggested_rewrite,
        expectedSeverity: fields.expected_severity,
      };
    })
    .filter(
      (item) =>
        item.patternId.length > 0 &&
        (item.triggerKeywords.length > 0 || item.linkedRules.length > 0),
    );

  return { packVersion, playbookId, items };
}

function mapSeverityHint(severityHint: PlaybookSeverityHint): PlaybookFinding['severity'] {
  switch (severityHint) {
    case 'HIGH':
      return 'HIGH';
    case 'LOW':
      return 'LOW';
    default:
      return 'MEDIUM';
  }
}

export type PlaybookEvaluationOptions = {
  caseReviewContext?: CaseReviewContext;
  /** When set, match_mode:link patterns fire from Rule hits instead of duplicate keywords. */
  priorRuleFindings?: Array<{ refId: string; evaluationDetail?: { matchedSpans?: Array<{ field: string; start: number; end: number; text: string }> } }>;
};

function augmentFindingWithCasePrecedent(
  finding: PlaybookFinding,
  caseReviewContext: CaseReviewContext,
): PlaybookFinding {
  const confirmedCount = caseReviewContext.precedentSummaries.filter((summary) =>
    summary.includes('status=CONFIRMED'),
  ).length;

  if (confirmedCount === 0 || !finding.evaluationDetail) {
    return finding;
  }

  const boost = Math.min(0.1, confirmedCount * 0.03);

  return {
    ...finding,
    confidence: Math.min(0.95, finding.confidence + boost),
    evaluationDetail: {
      ...finding.evaluationDetail,
      casePrecedentHint: `${confirmedCount} CONFIRMED precedent(s) support this pattern`,
    },
  };
}

function createPlaybookFinding(
  config: PlaybookEngineConfig,
  playbook: ParsedPlaybook,
  item: ParsedPlaybookItem,
  matchedSpan: { field: string; start: number; end: number; text: string },
): PlaybookFinding {
  const findingId = `pf_${(config.createFindingId ?? randomUUID)()}`;

  return {
    module: 'PLAYBOOK',
    findingId,
    severity: mapSeverityHint(item.severityHint),
    decision: item.playbookDecision,
    refType: 'PLAYBOOK_PATTERN',
    refId: item.patternId,
    refVersionId: `${playbook.playbookId}-${item.patternId}-v1`,
    summary: item.guidance,
    confidence: 0.85,
    evaluationDetail: {
      patternId: item.patternId,
      checklistIds: [],
      guidance: item.guidance,
      severityHint: item.severityHint,
      playbookDecision: item.playbookDecision,
      typicalDecision: item.typicalDecision,
      matchedSpans: [matchedSpan],
    },
  };
}

function matchesPlaybookScope(
  context: ReviewContext,
  item: ParsedPlaybookItem,
): boolean {
  if (item.scopeCountries?.length && !item.scopeCountries.includes(context.dimensions.countryId)) {
    return false;
  }
  if (
    item.scopeCategories?.length &&
    !item.scopeCategories.includes(context.dimensions.categoryId)
  ) {
    return false;
  }
  return true;
}

export class PlaybookEngineService {
  private parsedPlaybook: ParsedPlaybook | null = null;

  constructor(private readonly config: PlaybookEngineConfig = {}) {}

  evaluate(context: ReviewContext, options?: PlaybookEvaluationOptions): PlaybookEvaluationResult {
    const playbook = this.loadPlaybook();
    const fields = searchableFields(context);
    const findings: PlaybookFinding[] = [];
    const hitRuleIds = new Set((options?.priorRuleFindings ?? []).map((finding) => finding.refId));

    for (const item of playbook.items) {
      if (!matchesPlaybookScope(context, item)) {
        continue;
      }

      let matchedSpan: { field: string; start: number; end: number; text: string } | null = null;

      if (item.matchMode === 'link') {
        const linkedHit = (options?.priorRuleFindings ?? []).find((finding) =>
          item.linkedRules.includes(finding.refId),
        );
        if (!linkedHit && !item.linkedRules.some((ruleId) => hitRuleIds.has(ruleId))) {
          continue;
        }
        const ruleSpan = linkedHit?.evaluationDetail?.matchedSpans?.[0];
        matchedSpan = ruleSpan ?? {
          field: 'text',
          start: 0,
          end: 0,
          text: item.linkedRules[0] ?? item.patternId,
        };
      } else {
        matchedSpan = findTermMatch(fields, item.triggerKeywords);
        if (!matchedSpan) {
          continue;
        }
      }

      let finding = createPlaybookFinding(this.config, playbook, item, matchedSpan);
      if (options?.caseReviewContext && !options.caseReviewContext.coldStart) {
        finding = augmentFindingWithCasePrecedent(finding, options.caseReviewContext);
      }
      findings.push(finding);
    }

    const evaluatedAt = (this.config.now ?? (() => new Date()))().toISOString();

    return {
      reviewId: context.reviewId,
      playbookPackVersion:
        context.resolvedKnowledgeVersions.playbookPackVersion ?? playbook.packVersion,
      findings,
      evaluatedAt,
    };
  }

  private loadPlaybook(): ParsedPlaybook {
    if (this.parsedPlaybook) {
      return this.parsedPlaybook;
    }

    if (this.config.playbookMarkdown) {
      this.parsedPlaybook = parsePlaybookMarkdown(this.config.playbookMarkdown);
      return this.parsedPlaybook;
    }

    const playbookPath = this.config.playbookPath ?? defaultPlaybookPath;
    const readPlaybook = this.config.readPlaybook ?? ((path: string) => readFileSync(path, 'utf8'));
    this.parsedPlaybook = parsePlaybookMarkdown(readPlaybook(playbookPath));
    return this.parsedPlaybook;
  }
}
