import type { FastifyInstance } from 'fastify';
import type { CaseReportService } from '@aairp/application';
import { isCaseReportTemplate } from '@aairp/application';
import { AppError } from '@aairp/shared-kernel';

export type CaseReportControllerDeps = {
  caseReportService: CaseReportService;
};

export async function registerCaseReportController(
  app: FastifyInstance,
  deps: CaseReportControllerDeps,
): Promise<void> {
  app.get<{
    Params: { caseId: string };
    Querystring: { template?: string };
  }>('/demo/cases/:caseId/report', async (request, reply) => {
    const templateRaw = request.query.template ?? 'legal_audit';
    if (!isCaseReportTemplate(templateRaw)) {
      throw new AppError(
        'INVALID_REQUEST',
        400,
        'Bad Request',
        `template must be business_handoff or legal_audit (got: ${templateRaw})`,
      );
    }

    const result = await deps.caseReportService.render(request.params.caseId, templateRaw);
    reply
      .header('content-type', result.content_type)
      .header('content-disposition', `inline; filename="${result.filename}"`)
      .header('x-aairp-report-exportable', result.exportable ? 'true' : 'false')
      .code(200)
      .send(result.html);
  });
}
