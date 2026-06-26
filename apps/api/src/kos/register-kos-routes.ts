import type { FastifyInstance } from 'fastify';
import type { KosPublishService, KosSearchService, PlaybookAdminService, PromptAdminService, CaseKosAdminService, FeedbackAdminService, AuditLogService, RegulationAdminService, RuleAdminService } from '@aairp/application';
import { registerKosHealthController } from '../controllers/kos-health.controller.js';
import { registerKosSearchController } from '../controllers/kos-search.controller.js';
import { registerKosPublishController } from '../controllers/kos-publish.controller.js';
import { registerRegulationController } from '../controllers/regulation.controller.js';
import { registerRuleController } from '../controllers/rule.controller.js';
import { registerPlaybookController } from '../controllers/playbook.controller.js';
import { registerPromptController } from '../controllers/prompt.controller.js';
import { registerCaseController } from '../controllers/case.controller.js';
import { registerFeedbackController } from '../controllers/feedback.controller.js';
import { registerAuditController } from '../controllers/audit.controller.js';

export type KosRouteDeps = {
  serviceName: string;
  version: string;
  kosSearchService: KosSearchService;
  kosPublishService: KosPublishService;
  regulationAdminService: RegulationAdminService;
  ruleAdminService: RuleAdminService;
  playbookAdminService: PlaybookAdminService;
  promptAdminService: PromptAdminService;
  caseKosAdminService: CaseKosAdminService;
  feedbackAdminService: FeedbackAdminService;
  auditLogService: AuditLogService;
};

export async function registerKosRoutes(
  app: FastifyInstance,
  deps: KosRouteDeps,
): Promise<void> {
  await app.register(
    async (kosApp) => {
      await registerKosHealthController(kosApp, {
        serviceName: deps.serviceName,
        version: deps.version,
      });
      await registerKosSearchController(kosApp, {
        kosSearchService: deps.kosSearchService,
      });
      await registerKosPublishController(kosApp, {
        kosPublishService: deps.kosPublishService,
      });
      await registerRegulationController(kosApp, {
        regulationAdminService: deps.regulationAdminService,
      });
      await registerRuleController(kosApp, {
        ruleAdminService: deps.ruleAdminService,
      });
      await registerPlaybookController(kosApp, {
        playbookAdminService: deps.playbookAdminService,
      });
      await registerPromptController(kosApp, {
        promptAdminService: deps.promptAdminService,
      });
      await registerCaseController(kosApp, {
        caseKosAdminService: deps.caseKosAdminService,
      });
      await registerFeedbackController(kosApp, {
        feedbackAdminService: deps.feedbackAdminService,
      });
      await registerAuditController(kosApp, {
        auditLogService: deps.auditLogService,
      });
    },
    { prefix: '/kos/v1' },
  );
}
