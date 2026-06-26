import { AppError } from '@aairp/shared-kernel';

export type CreatePromptPackBody = {
  pack_key: string;
  name: string;
  description?: string;
};

export type CreatePromptTemplateBody = {
  template_key: string;
  template_type?: string;
};

export type CreatePromptVersionBody = {
  content: string;
  schema_version?: string;
  tags?: string[];
};

export type UpdatePromptVersionBody = Partial<CreatePromptVersionBody>;

export type LintPromptContentBody = {
  content: string;
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

function requireContent(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid field: content');
  }
  return value;
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

export function parseCreatePromptPackBody(body: unknown): CreatePromptPackBody {
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

export function parseCreatePromptTemplateBody(body: unknown): CreatePromptTemplateBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  return {
    template_key: requireString(record.template_key, 'template_key'),
    template_type: optionalString(record.template_type),
  };
}

export function parseCreatePromptVersionBody(body: unknown): CreatePromptVersionBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  return {
    content: requireContent(record.content),
    schema_version: optionalString(record.schema_version),
    tags: optionalTags(record.tags),
  };
}

export function parseUpdatePromptVersionBody(body: unknown): UpdatePromptVersionBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  const parsed: UpdatePromptVersionBody = {};
  if (record.content !== undefined) parsed.content = requireContent(record.content);
  if (record.schema_version !== undefined) {
    parsed.schema_version = optionalString(record.schema_version);
  }
  if (record.tags !== undefined) parsed.tags = optionalTags(record.tags);
  return parsed;
}

export function parseLintPromptContentBody(body: unknown): LintPromptContentBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  return { content: requireContent((body as Record<string, unknown>).content) };
}

export { parseKosActorHeaders, parseRegulationListQuery as parsePromptListQuery } from './regulation-request.js';
