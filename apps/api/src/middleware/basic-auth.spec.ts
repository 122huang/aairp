import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import {
  credentialsMatchReviewBasicAuth,
  loadReviewBasicAuthConfig,
  pathRequiresReviewBasicAuth,
  registerReviewBasicAuth,
} from './basic-auth.js';

describe('loadReviewBasicAuthConfig', () => {
  it('is disabled when either env var is missing', () => {
    expect(loadReviewBasicAuthConfig({})).toEqual({
      enabled: false,
      user: '',
      password: '',
    });
    expect(
      loadReviewBasicAuthConfig({ AAIRP_REVIEW_BASIC_AUTH_USER: 'pilot' }),
    ).toMatchObject({ enabled: false });
    expect(
      loadReviewBasicAuthConfig({ AAIRP_REVIEW_BASIC_AUTH_PASSWORD: 'secret' }),
    ).toMatchObject({ enabled: false });
  });

  it('is enabled when both user and password are set', () => {
    expect(
      loadReviewBasicAuthConfig({
        AAIRP_REVIEW_BASIC_AUTH_USER: ' pilot ',
        AAIRP_REVIEW_BASIC_AUTH_PASSWORD: 's3cret',
      }),
    ).toEqual({
      enabled: true,
      user: 'pilot',
      password: 's3cret',
    });
  });
});

describe('pathRequiresReviewBasicAuth', () => {
  it('covers review UI and demo APIs', () => {
    expect(pathRequiresReviewBasicAuth('/')).toBe(true);
    expect(pathRequiresReviewBasicAuth('/review')).toBe(true);
    expect(pathRequiresReviewBasicAuth('/review/index.html')).toBe(true);
    expect(pathRequiresReviewBasicAuth('/review/assets/x.js')).toBe(true);
    expect(pathRequiresReviewBasicAuth('/demo/review')).toBe(true);
    expect(pathRequiresReviewBasicAuth('/demo/advertisements?x=1')).toBe(true);
    expect(pathRequiresReviewBasicAuth('/demo-ui')).toBe(true);
  });

  it('leaves health and admin surfaces open', () => {
    expect(pathRequiresReviewBasicAuth('/health')).toBe(false);
    expect(pathRequiresReviewBasicAuth('/ready')).toBe(false);
    expect(pathRequiresReviewBasicAuth('/admin-ui/')).toBe(false);
    expect(pathRequiresReviewBasicAuth('/knowledge/')).toBe(false);
    expect(pathRequiresReviewBasicAuth('/api/knowledge/preview')).toBe(false);
  });
});

describe('credentialsMatchReviewBasicAuth', () => {
  const config = {
    enabled: true,
    user: 'pilot',
    password: 's3cret',
  };

  it('accepts exact match and rejects mismatches', () => {
    expect(credentialsMatchReviewBasicAuth('pilot', 's3cret', config)).toBe(true);
    expect(credentialsMatchReviewBasicAuth('pilot', 'wrong', config)).toBe(false);
    expect(credentialsMatchReviewBasicAuth('other', 's3cret', config)).toBe(false);
  });
});

describe('registerReviewBasicAuth', () => {
  it('returns 401 without credentials and 200 with valid Basic Auth', async () => {
    const app = Fastify({ logger: false });
    registerReviewBasicAuth(app, {
      enabled: true,
      user: 'pilot',
      password: 's3cret',
    });
    app.get('/demo/review', async () => ({ ok: true }));
    app.get('/health', async () => ({ status: 'ok' }));

    const denied = await app.inject({ method: 'GET', url: '/demo/review' });
    expect(denied.statusCode).toBe(401);
    expect(denied.headers['www-authenticate']).toMatch(/Basic/);

    const allowed = await app.inject({
      method: 'GET',
      url: '/demo/review',
      headers: {
        authorization: `Basic ${Buffer.from('pilot:s3cret').toString('base64')}`,
      },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toEqual({ ok: true });

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);

    await app.close();
  });

  it('does nothing when auth is disabled', async () => {
    const app = Fastify({ logger: false });
    registerReviewBasicAuth(app, { enabled: false, user: '', password: '' });
    app.get('/demo/review', async () => ({ ok: true }));

    const res = await app.inject({ method: 'GET', url: '/demo/review' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
