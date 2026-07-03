import { AppError, buildPatternMarkdownBody } from '@aairp/shared-kernel';

export type CreatePlaybookPackBody = {
  pack_key: string;
  name: string;
  description?: string;
};

export type CreatePlaybookPatternBody = {
  ref_id: string;
  match_type?: string;
  terms: string[];
  guidance?: string;
  markdown_body?: string;
  severity_hint?: string;
  decision?: string;
  typical_decision?: string;
  skill_module?: string;
  purpose?: string;
  suggested_rewrite?: string;
  expected_severity?: string;
};

export type UpdatePlaybookPatternBody = Partial<CreatePlaybookPatternBody>;

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', `Invalid field: ${field}`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid string field');
  }
  return value.trim() || undefined;
}

function requireStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', `Invalid field: ${field}`);
  }
  return value.map((item) => item.trim()).filter((item) => item.length > 0);
}

function resolveMarkdownBody(record: Record<string, unknown>): string | undefined {
  const explicit = optionalString(record.markdown_body);
  if (explicit) {
    return explicit;
  }
  if (
    record.severity_hint !== undefined ||
    record.decision !== undefined ||
    record.typical_decision !== undefined ||
    record.skill_module !== undefined ||
    record.purpose !== undefined ||
    record.suggested_rewrite !== undefined ||
    record.expected_severity !== undefined
  ) {
    return buildPatternMarkdownBody({
      severityHint: optionalString(record.severity_hint),
      decision: optionalString(record.decision),
      typicalDecision: optionalString(record.typical_decision),
      skillModule: optionalString(record.skill_module),
      purpose: optionalString(record.purpose),
      suggestedRewrite: optionalString(record.suggested_rewrite),
      expectedSeverity: optionalString(record.expected_severity),
    });
  }
  return undefined;
}

export function parseCreatePlaybookPackBody(body: unknown): CreatePlaybookPackBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  return {
    pack_key: requireString(record.pack_key, 'pack_key'),
    name: requireString(record.name, 'name'),
    description: optionalString(record.description),
  };
}

export function parseCreatePlaybookPatternBody(body: unknown): CreatePlaybookPatternBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  return {
    ref_id: requireString(record.ref_id, 'ref_id'),
    match_type: optionalString(record.match_type),
    terms: requireStringList(record.terms, 'terms'),
    guidance: optionalString(record.guidance),
    markdown_body: resolveMarkdownBody(record),
    severity_hint: optionalString(record.severity_hint),
    decision: optionalString(record.decision),
    typical_decision: optionalString(record.typical_decision),
    skill_module: optionalString(record.skill_module),
    purpose: optionalString(record.purpose),
    suggested_rewrite: optionalString(record.suggested_rewrite),
    expected_severity: optionalString(record.expected_severity),
  };
}

export function parseUpdatePlaybookPatternBody(body: unknown): UpdatePlaybookPatternBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  const parsed: UpdatePlaybookPatternBody = {};
  if (record.ref_id !== undefined) parsed.ref_id = requireString(record.ref_id, 'ref_id');
  if (record.match_type !== undefined) parsed.match_type = optionalString(record.match_type);
  if (record.terms !== undefined) parsed.terms = requireStringList(record.terms, 'terms');
  if (record.guidance !== undefined) parsed.guidance = optionalString(record.guidance);
  if (record.markdown_body !== undefined) {
    parsed.markdown_body = optionalString(record.markdown_body);
  } else if (
    record.severity_hint !== undefined ||
    record.decision !== undefined ||
    record.typical_decision !== undefined ||
    record.skill_module !== undefined ||
    record.purpose !== undefined ||
    record.suggested_rewrite !== undefined ||
    record.expected_severity !== undefined
  ) {
    parsed.markdown_body = resolveMarkdownBody(record);
  }
  if (record.severity_hint !== undefined) {
    parsed.severity_hint = optionalString(record.severity_hint);
  }
  if (record.decision !== undefined) parsed.decision = optionalString(record.decision);
  if (record.typical_decision !== undefined) {
    parsed.typical_decision = optionalString(record.typical_decision);
  }
  if (record.skill_module !== undefined) {
    parsed.skill_module = optionalString(record.skill_module);
  }
  if (record.purpose !== undefined) parsed.purpose = optionalString(record.purpose);
  if (record.suggested_rewrite !== undefined) {
    parsed.suggested_rewrite = optionalString(record.suggested_rewrite);
  }
  if (record.expected_severity !== undefined) {
    parsed.expected_severity = optionalString(record.expected_severity);
  }
  return parsed;
}

export { parseKosActorHeaders, parseRegulationListQuery as parsePlaybookListQuery } from './regulation-request.js';
