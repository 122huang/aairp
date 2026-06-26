import { AppError } from '@aairp/shared-kernel';
import type { RuleScope } from '@aairp/shared-kernel';

export type CreateRulePackBody = {
  pack_key: string;
  name: string;
  description?: string;
};

export type CreateRuleBody = {
  rule_key: string;
  display_name?: string;
};

export type CreateRuleVersionBody = {
  severity: string;
  decision: string;
  summary: string;
  scope: RuleScope;
  payload?: Record<string, unknown>;
  owner?: string;
  tags?: string[];
  regulation_version_ids?: string[];
};

export type UpdateRuleVersionBody = Partial<CreateRuleVersionBody>;

export type SetRegulationLinksBody = {
  regulation_version_ids: string[];
};

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

function parseScope(value: unknown): RuleScope {
  if (!value || typeof value !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid field: scope');
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.countries) || !Array.isArray(record.categories)) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid field: scope');
  }
  return {
    countries: record.countries.filter((item): item is string => typeof item === 'string'),
    categories: record.categories.filter((item): item is string => typeof item === 'string'),
  };
}

function optionalPayload(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid field: payload');
  }
  return value as Record<string, unknown>;
}

function optionalTags(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid field: tags');
  }
  return value;
}

function optionalUuidList(value: unknown, field: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', `Invalid field: ${field}`);
  }
  return value;
}

export function parseCreateRulePackBody(body: unknown): CreateRulePackBody {
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

export function parseCreateRuleBody(body: unknown): CreateRuleBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  return {
    rule_key: requireString(record.rule_key, 'rule_key'),
    display_name: optionalString(record.display_name),
  };
}

export function parseCreateRuleVersionBody(body: unknown): CreateRuleVersionBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  return {
    severity: requireString(record.severity, 'severity'),
    decision: requireString(record.decision, 'decision'),
    summary: requireString(record.summary, 'summary'),
    scope: parseScope(record.scope),
    payload: optionalPayload(record.payload) ?? {},
    owner: optionalString(record.owner),
    tags: optionalTags(record.tags),
    regulation_version_ids: optionalUuidList(record.regulation_version_ids, 'regulation_version_ids'),
  };
}

export function parseUpdateRuleVersionBody(body: unknown): UpdateRuleVersionBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  const parsed: UpdateRuleVersionBody = {};
  if (record.severity !== undefined) parsed.severity = requireString(record.severity, 'severity');
  if (record.decision !== undefined) parsed.decision = requireString(record.decision, 'decision');
  if (record.summary !== undefined) parsed.summary = requireString(record.summary, 'summary');
  if (record.scope !== undefined) parsed.scope = parseScope(record.scope);
  if (record.payload !== undefined) parsed.payload = optionalPayload(record.payload) ?? {};
  if (record.owner !== undefined) parsed.owner = optionalString(record.owner);
  if (record.tags !== undefined) parsed.tags = optionalTags(record.tags);
  if (record.regulation_version_ids !== undefined) {
    parsed.regulation_version_ids = optionalUuidList(
      record.regulation_version_ids,
      'regulation_version_ids',
    );
  }
  return parsed;
}

export function parseSetRegulationLinksBody(body: unknown): SetRegulationLinksBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const ids = optionalUuidList(
    (body as Record<string, unknown>).regulation_version_ids,
    'regulation_version_ids',
  );
  return { regulation_version_ids: ids ?? [] };
}

export { parseKosActorHeaders, parseRegulationListQuery as parseRuleListQuery } from './regulation-request.js';
