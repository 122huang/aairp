import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

const demoUiRoot = join(dirname(fileURLToPath(import.meta.url)), '../../demo-ui/public');

/** RC1-Demo: serve static UI from apps/demo-ui/public (no review logic changes). */
export async function registerDemoUi(app: FastifyInstance): Promise<void> {
  await app.register(fastifyStatic, {
    root: demoUiRoot,
    prefix: '/demo-ui/',
    decorateReply: false,
  });

  app.get('/', async (_request, reply) => {
    return reply.redirect('/demo-ui/index.html');
  });

  app.get('/demo-ui', async (_request, reply) => {
    return reply.redirect('/demo-ui/index.html');
  });
}
