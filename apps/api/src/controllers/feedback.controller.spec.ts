import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FeedbackAdminService } from '@aairp/application';
import { registerFeedbackController } from './feedback.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

function createServiceMock(): FeedbackAdminService {
  return {
    search: vi.fn().mockResolvedValue({
      items: [
        {
          feedbackId: 'fb-1',
          caseId: 'pilot-p001-sg',
          pilotId: 'P-001',
          status: 'open',
          ratings: {},
          metadata: { category: 'GAP' },
          createdAt: '2026-06-26T10:00:00.000Z',
          updatedAt: '2026-06-26T10:00:00.000Z',
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    }),
    getFeedback: vi.fn(),
    createFeedback: vi.fn(),
    updateFeedback: vi.fn(),
    upsertByCaseId: vi.fn(),
  } as unknown as FeedbackAdminService;
}

async function buildTestApp(service: FeedbackAdminService) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerFeedbackController(app, { feedbackAdminService: service });
  await app.ready();
  return app;
}

describe('FeedbackController', () => {
  it('GET /feedback returns paginated list', async () => {
    const service = createServiceMock();
    const app = await buildTestApp(service);

    const response = await app.inject({
      method: 'GET',
      url: '/feedback?pilot_id=P-001',
      headers: { accept: 'application/json' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      total: 1,
      items: [{ case_id: 'pilot-p001-sg', pilot_id: 'P-001' }],
    });
    await app.close();
  });
});
