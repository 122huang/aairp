import type { FastifyInstance } from 'fastify';
import {
  collectMatchedCorpusIds,
  recordPreviewFeedback,
  resolveKnowledgeEvalLinkageStamp,
  type PreviewFeedbackType,
} from '@aairp/application';
import { sendJson } from '../middleware/http.js';

type PreviewFeedbackBody = {
  preview_id?: string;
  feedback_type?: PreviewFeedbackType;
  claim_text_hash?: string;
  primary_skill?: string | null;
  matched_skills?: string[];
  matched_corpus_entries?: string[];
  country?: string | null;
  linked_knowledge?: {
    regulations: Array<{ knowledge_id: string }>;
    evidence: Array<{ knowledge_id: string }>;
    rewrites: Array<{ knowledge_id: string }>;
    cases: Array<{ knowledge_id: string }>;
  };
};

export async function registerKnowledgePreviewFeedbackController(
  app: FastifyInstance,
): Promise<void> {
  app.post('/api/knowledge/preview/feedback', async (request, reply) => {
    const body = (request.body ?? {}) as PreviewFeedbackBody;
    const previewId = body.preview_id?.trim();
    const feedbackType = body.feedback_type;
    const claimTextHash = body.claim_text_hash?.trim();

    if (!previewId || !feedbackType || !claimTextHash) {
      return reply.status(400).send({
        type: 'https://aairp.example.com/problems/invalid-request',
        title: 'Bad Request',
        status: 400,
        detail: 'preview_id, feedback_type, and claim_text_hash are required',
      });
    }

    if (feedbackType !== 'yes' && feedbackType !== 'needs_update') {
      return reply.status(400).send({
        type: 'https://aairp.example.com/problems/invalid-request',
        title: 'Bad Request',
        status: 400,
        detail: 'feedback_type must be yes or needs_update',
      });
    }

    const reviewerRole =
      (request.headers['x-knowledge-reviewer-role'] as string | undefined)?.trim() || null;

    const matchedCorpusEntries =
      body.matched_corpus_entries ??
      (body.linked_knowledge ? collectMatchedCorpusIds(body.linked_knowledge) : []);

    const record = recordPreviewFeedback({
      preview_id: previewId,
      feedback_type: feedbackType,
      claim_text_hash: claimTextHash,
      primary_skill: body.primary_skill ?? null,
      matched_skills: body.matched_skills ?? [],
      matched_corpus_entries: matchedCorpusEntries,
      country: body.country ?? null,
      reviewer_role: reviewerRole,
      linkage: resolveKnowledgeEvalLinkageStamp(),
    });

    request.log.info(
      {
        feedback_id: record.feedback_id,
        feedback_type: record.feedback_type,
        preview_id: record.preview_id,
        knowledge_pack_id: record.knowledge_pack_id,
      },
      'knowledge preview feedback captured',
    );

    sendJson(reply, 201, record);
  });
}
