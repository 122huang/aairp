import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const reviewAppDist = join(apiRoot, 'review-app/dist');
const reviewUiRoot = join(apiRoot, 'review-ui/public');
const adminUiRoot = join(apiRoot, 'admin-ui/public');
const knowledgeUiRoot = join(apiRoot, 'knowledge-ui/public');
const legacyDemoUiRoot = join(apiRoot, 'demo-ui/public');

/** User review UI (6U React app when built) + admin UI + legacy demo-ui redirect. */
export async function registerDemoUi(app: FastifyInstance): Promise<void> {
  const reviewStaticRoot = existsSync(join(reviewAppDist, 'index.html')) ? reviewAppDist : reviewUiRoot;

  await app.register(fastifyStatic, {
    root: reviewStaticRoot,
    prefix: '/review/',
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: adminUiRoot,
    prefix: '/admin-ui/',
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: knowledgeUiRoot,
    prefix: '/knowledge/',
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: legacyDemoUiRoot,
    prefix: '/demo-ui/',
    decorateReply: false,
  });

  app.get('/', async (_request, reply) => {
    return reply.redirect('/review/index.html');
  });

  app.get('/review', async (_request, reply) => {
    return reply.redirect('/review/index.html');
  });

  app.get('/knowledge', async (_request, reply) => {
    return reply.redirect('/knowledge/index.html');
  });

  app.get('/demo-ui', async (_request, reply) => {
    return reply.redirect('/review/index.html');
  });
}
