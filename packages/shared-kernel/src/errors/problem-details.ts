export const PROBLEM_BASE_URI = 'https://aairp.example.com/problems';

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  trace_id: string;
  errors: unknown[];
  checks?: Record<string, unknown>;
};

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'METHOD_NOT_ALLOWED'
  | 'NOT_ACCEPTABLE'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

const ERROR_TYPE_SUFFIX: Record<ErrorCode, string> = {
  INVALID_REQUEST: 'bad-request',
  METHOD_NOT_ALLOWED: 'method-not-allowed',
  NOT_ACCEPTABLE: 'not-acceptable',
  NOT_FOUND: 'not-found',
  CONFLICT: 'conflict',
  SERVICE_UNAVAILABLE: 'service-unavailable',
  INTERNAL_ERROR: 'internal-error',
};

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    public readonly title: string,
    public readonly detail: string,
    public readonly extras?: Record<string, unknown>,
  ) {
    super(detail);
    this.name = 'AppError';
  }

  toProblemDetails(instance: string, traceId: string): ProblemDetails {
    const errors = Array.isArray(this.extras?.errors) ? this.extras.errors : [];
    const { errors: _ignored, ...restExtras } = this.extras ?? {};

    return {
      type: `${PROBLEM_BASE_URI}/${ERROR_TYPE_SUFFIX[this.code]}`,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance,
      trace_id: traceId,
      errors,
      ...restExtras,
    };
  }
}

export function createProblemDetails(
  code: ErrorCode,
  instance: string,
  traceId: string,
  detail?: string,
  extras?: Record<string, unknown>,
): ProblemDetails {
  const map: Record<
    ErrorCode,
    { status: number; title: string; defaultDetail: string }
  > = {
    INVALID_REQUEST: {
      status: 400,
      title: 'Bad Request',
      defaultDetail: 'Invalid request',
    },
    METHOD_NOT_ALLOWED: {
      status: 405,
      title: 'Method Not Allowed',
      defaultDetail: 'Method not allowed',
    },
    NOT_ACCEPTABLE: {
      status: 406,
      title: 'Not Acceptable',
      defaultDetail: 'Accept header not supported',
    },
    NOT_FOUND: {
      status: 404,
      title: 'Not Found',
      defaultDetail: 'Resource not found',
    },
    CONFLICT: {
      status: 409,
      title: 'Conflict',
      defaultDetail: 'Operation cannot be applied in the current state',
    },
    SERVICE_UNAVAILABLE: {
      status: 503,
      title: 'Service Unavailable',
      defaultDetail: 'One or more dependencies are not ready',
    },
    INTERNAL_ERROR: {
      status: 500,
      title: 'Internal Server Error',
      defaultDetail: 'Unexpected error',
    },
  };

  const entry = map[code];
  return {
    type: `${PROBLEM_BASE_URI}/${ERROR_TYPE_SUFFIX[code]}`,
    title: entry.title,
    status: entry.status,
    detail: detail ?? entry.defaultDetail,
    instance,
    trace_id: traceId,
    errors: [],
    ...(extras ?? {}),
  };
}
