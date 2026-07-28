import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { VisionComplianceService } from '@aairp/application';
import { registerImageReviewExtractController } from './image-review-extract.controller.js';
import { registerErrorHandler, registerTraceMiddleware } from '../middleware/http.js';

async function buildApp(discover: VisionComplianceService['discover']) {
  const app = Fastify();
  registerTraceMiddleware(app);
  registerErrorHandler(app);
  await registerImageReviewExtractController(app, {
    visionComplianceService: { discover } as VisionComplianceService,
  });
  return app;
}

describe('image-review-extract.controller', () => {
  it('POST /demo/image-review/extract-text returns joined text and lines', async () => {
    const discover = vi.fn().mockResolvedValue({
      manifests: [{ imageIndex: 0, slices: [{}, {}] }],
      findings: [],
      skipped: false,
      extractedText: ['  Non-stick  ', '', 'up to 2 kg'],
    });
    const app = await buildApp(discover);

    const response = await app.inject({
      method: 'POST',
      url: '/demo/image-review/extract-text',
      payload: {
        image_base64: 'aaaa',
        mime_type: 'image/jpeg',
        country_id: 'SG',
        category_id: 'sa.other',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      text: string;
      lines: string[];
      slice_count: number;
      vision_skipped: boolean;
    };
    expect(body.text).toBe('Non-stick\nup to 2 kg');
    expect(body.lines).toEqual(['Non-stick', 'up to 2 kg']);
    expect(body.slice_count).toBe(2);
    expect(body.vision_skipped).toBe(false);
    expect(discover).toHaveBeenCalledOnce();

    await app.close();
  });

  it('returns 400 when image_base64 is missing', async () => {
    const app = await buildApp(vi.fn());
    const response = await app.inject({
      method: 'POST',
      url: '/demo/image-review/extract-text',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 503 when vision is skipped', async () => {
    const discover = vi.fn().mockResolvedValue({
      manifests: [],
      findings: [],
      skipped: true,
      skipReason: 'VISION_MODE_OFF',
    });
    const app = await buildApp(discover);
    const response = await app.inject({
      method: 'POST',
      url: '/demo/image-review/extract-text',
      payload: { image_base64: 'aaaa' },
    });
    expect(response.statusCode).toBe(503);
    await app.close();
  });
});
