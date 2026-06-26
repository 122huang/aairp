import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, createProblemDetails } from '@aairp/shared-kernel';
import { validateAcceptHeader } from '../validation/query-params.js';

declare module 'fastify' {
  interface FastifyRequest {
    traceId: string;
  }
}

export function registerTraceMiddleware(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const traceId =
      (typeof request.headers['x-trace-id'] === 'string' &&
        request.headers['x-trace-id']) ||
      (typeof request.headers['x-request-id'] === 'string' &&
        request.headers['x-request-id']) ||
      randomUUID();

    request.traceId = traceId;
    request.log = request.log.child({ trace_id: traceId });
    reply.header('X-Trace-Id', traceId);
    reply.header('X-Request-Id', traceId);
    reply.header('Cache-Control', 'no-store');
  });
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const traceId = request.traceId ?? randomUUID();
    const instance = request.url.split('?')[0] ?? request.url;

    if (error instanceof AppError) {
      const problem = error.toProblemDetails(instance, traceId);
      reply
        .code(error.status)
        .type('application/problem+json')
        .send(problem);
      return;
    }

    request.log.error({ err: error, trace_id: traceId }, 'unhandled error');
    const problem = createProblemDetails(
      'INTERNAL_ERROR',
      instance,
      traceId,
    );
    reply.code(500).type('application/problem+json').send(problem);
  });
}

export function sendJson(reply: FastifyReply, statusCode: number, body: unknown): void {
  reply.code(statusCode).type('application/json').send(body);
}

export type ProbePreHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export function createProbePreHandler(): ProbePreHandler {
  return async (request) => {
    validateAcceptHeader(request.headers.accept);
  };
}
