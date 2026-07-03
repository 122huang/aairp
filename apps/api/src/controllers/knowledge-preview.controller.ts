import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildKnowledgePreviewReport } from '@aairp/application';
import { toKnowledgePreviewResponseDto } from '../dto/knowledge-preview.dto.js';
import { sendJson } from '../middleware/http.js';

type KnowledgePreviewBody = {
  claim_text?: string;
  country?: string;
  category?: string;
  modality?: string;
};

export async function registerKnowledgePreviewController(
  app: FastifyInstance,
): Promise<void> {
  app.post('/api/knowledge/preview', async (request, reply) => {
    const body = (request.body ?? {}) as KnowledgePreviewBody;
    const claimText = body.claim_text?.trim();

    if (!claimText) {
      return reply.status(400).send({
        type: 'https://aairp.example.com/problems/invalid-request',
        title: 'Bad Request',
        status: 400,
        detail: 'claim_text is required',
      });
    }

    const report = buildKnowledgePreviewReport({
      claim_text: claimText,
      country: body.country?.trim() || undefined,
      category: body.category?.trim() || undefined,
      modality: body.modality?.trim() || undefined,
    });

    const inputHash = createHash('sha256').update(claimText).digest('hex').slice(0, 16);
    request.log.info(
      {
        knowledge_pack_id: report.knowledge_pack_id,
        input_hash: inputHash,
        matched_skills: report.matched_skills.map((skill) => skill.knowledge_id),
        primary_skill: report.primary_skill,
      },
      'knowledge preview generated',
    );

    sendJson(reply, 200, toKnowledgePreviewResponseDto(report));
  });
}
