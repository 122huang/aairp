import type { CaseReportAssemblyService } from './case-report-assembly.service.js';
import { renderBusinessHandoffHtml, renderLegalAuditHtml } from './case-report-html.js';
import type {
  CaseReportRenderResult,
  CaseReportTemplate,
} from './case-report.model.js';

export class CaseReportService {
  constructor(private readonly assembly: CaseReportAssemblyService) {}

  async render(caseId: string, template: CaseReportTemplate): Promise<CaseReportRenderResult> {
    const model = await this.assembly.assemble(caseId, template);
    const html =
      template === 'business_handoff'
        ? renderBusinessHandoffHtml(model)
        : renderLegalAuditHtml(model);

    const exportable =
      template === 'legal_audit' || model.business_handoff.eligible;

    const suffix = template === 'business_handoff' ? 'business-handoff' : 'legal-audit';
    return {
      template,
      case_id: caseId,
      content_type: 'text/html; charset=utf-8',
      filename: `${caseId}-${suffix}.html`,
      html,
      exportable,
    };
  }
}
