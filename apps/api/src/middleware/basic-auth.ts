import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export type ReviewBasicAuthConfig = {
  enabled: boolean;
  user: string;
  password: string;
};

/** Shared-password gate for /review UI and /demo APIs. Off when either env var is unset. */
export function loadReviewBasicAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): ReviewBasicAuthConfig {
  const user = env.AAIRP_REVIEW_BASIC_AUTH_USER?.trim() ?? '';
  const password = env.AAIRP_REVIEW_BASIC_AUTH_PASSWORD ?? '';
  return {
    enabled: user.length > 0 && password.length > 0,
    user,
    password,
  };
}

export function pathRequiresReviewBasicAuth(url: string): boolean {
  const path = (url.split('?')[0] ?? url) || '/';
  if (path === '/' || path === '/review' || path.startsWith('/review/')) {
    return true;
  }
  if (path === '/demo-ui' || path.startsWith('/demo-ui/')) {
    return true;
  }
  if (path === '/demo' || path.startsWith('/demo/')) {
    return true;
  }
  return false;
}

function safeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function sendUnauthorized(reply: FastifyReply): void {
  void reply
    .header('WWW-Authenticate', 'Basic realm="AAIRP Review", charset="UTF-8"')
    .code(401)
    .type('text/plain')
    .send('Authentication required');
}

function parseBasicCredentials(
  authorization: string | undefined,
): { user: string; password: string } | null {
  if (!authorization || !authorization.startsWith('Basic ')) {
    return null;
  }
  let decoded: string;
  try {
    decoded = Buffer.from(authorization.slice('Basic '.length).trim(), 'base64').toString(
      'utf8',
    );
  } catch {
    return null;
  }
  const colon = decoded.indexOf(':');
  if (colon < 0) {
    return null;
  }
  return {
    user: decoded.slice(0, colon),
    password: decoded.slice(colon + 1),
  };
}

export function credentialsMatchReviewBasicAuth(
  providedUser: string,
  providedPassword: string,
  config: ReviewBasicAuthConfig,
): boolean {
  return (
    safeEqualString(providedUser, config.user) &&
    safeEqualString(providedPassword, config.password)
  );
}

/**
 * HTTP Basic Auth for the review surface only.
 * Leaves /health, /ready, admin/knowledge/KOS routes open.
 */
export function registerReviewBasicAuth(
  app: FastifyInstance,
  config: ReviewBasicAuthConfig = loadReviewBasicAuthConfig(),
): void {
  if (!config.enabled) {
    app.log.warn(
      'AAIRP_REVIEW_BASIC_AUTH_USER/PASSWORD unset — /review and /demo are publicly reachable',
    );
    return;
  }

  app.log.info('Review Basic Auth enabled for /, /review*, /demo*, /demo-ui*');

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!pathRequiresReviewBasicAuth(request.url)) {
      return;
    }

    const creds = parseBasicCredentials(request.headers.authorization);
    if (
      !creds ||
      !credentialsMatchReviewBasicAuth(creds.user, creds.password, config)
    ) {
      sendUnauthorized(reply);
    }
  });
}
