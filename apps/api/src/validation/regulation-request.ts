import { AppError } from '@aairp/shared-kernel';

export type CreateRegulationBody = {
  regulation_key: string;
  jurisdiction: string;
};

export type CreateRegulationVersionBody = {
  law_name: string;
  article?: string;
  source_url?: string;
  body_text?: string;
  tags?: string[];
  search_text?: string;
};

export type UpdateRegulationVersionBody = Partial<CreateRegulationVersionBody>;

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

function optionalTags(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid field: tags');
  }
  return value;
}

export function parseCreateRegulationBody(body: unknown): CreateRegulationBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  return {
    regulation_key: requireString(record.regulation_key, 'regulation_key'),
    jurisdiction: requireString(record.jurisdiction, 'jurisdiction'),
  };
}

export function parseCreateRegulationVersionBody(
  body: unknown,
): CreateRegulationVersionBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  return {
    law_name: requireString(record.law_name, 'law_name'),
    article: optionalString(record.article),
    source_url: optionalString(record.source_url),
    body_text: optionalString(record.body_text),
    tags: optionalTags(record.tags),
    search_text: optionalString(record.search_text),
  };
}

export function parseUpdateRegulationVersionBody(
  body: unknown,
): UpdateRegulationVersionBody {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Request body is required');
  }
  const record = body as Record<string, unknown>;
  const parsed: UpdateRegulationVersionBody = {};
  if (record.law_name !== undefined) {
    parsed.law_name = requireString(record.law_name, 'law_name');
  }
  if (record.article !== undefined) {
    parsed.article = optionalString(record.article);
  }
  if (record.source_url !== undefined) {
    parsed.source_url = optionalString(record.source_url);
  }
  if (record.body_text !== undefined) {
    parsed.body_text = optionalString(record.body_text);
  }
  if (record.tags !== undefined) {
    parsed.tags = optionalTags(record.tags);
  }
  if (record.search_text !== undefined) {
    parsed.search_text = optionalString(record.search_text);
  }
  return parsed;
}

export function parseRegulationListQuery(query: Record<string, unknown>) {
  const jurisdiction =
    typeof query.jurisdiction === 'string' ? query.jurisdiction.trim() : undefined;
  const q = typeof query.q === 'string' ? query.q.trim() : undefined;
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid query parameter: limit');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new AppError('INVALID_REQUEST', 400, 'Bad Request', 'Invalid query parameter: offset');
  }

  return { jurisdiction, q, limit, offset };
}

export function parseKosActorHeaders(headers: Record<string, unknown>): {
  actor?: string;
  traceId?: string;
} {
  const actor =
    typeof headers['x-kos-actor'] === 'string' ? headers['x-kos-actor'] : undefined;
  const traceId =
    typeof headers['x-trace-id'] === 'string'
      ? headers['x-trace-id']
      : typeof headers['x-request-id'] === 'string'
        ? headers['x-request-id']
        : undefined;
  return { actor, traceId };
}
