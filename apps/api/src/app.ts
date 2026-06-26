import Fastify from 'fastify';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import {
  HealthService,
  AdvertisementUploadService,
  ReviewHappyPathService,
  CaseBuilderService,
  CaseRecorderService,
  CaseSearchService,
  CaseExportService,
  CaseKosAdminService,
  KosSearchService,
  KosPublishService,
  RegulationAdminService,
  RuleAdminService,
  PlaybookAdminService,
  PromptAdminService,
  FeedbackAdminService,
  AuditLogService,
  resolveCaseLibraryRoot,
  resolveCaseStorageMode,
  bootstrapReviewRuntime,
} from '@aairp/application';
import type { ICaseStore } from '@aairp/shared-kernel';
import {
  HealthRepository,
  InMemoryAdvertisementRepository,
  JsonCaseStore,
  KosCaseStoreAdapter,
  DualWriteCaseStore,
  PgCaseKosRepository,
  PgCaseEmbeddingRepository,
  PgDatabaseClient,
  PgKosSearchRepository,
  PgAuditLogRepository,
  PgKosPublishRepository,
  PgRegulationRepository,
  PgRuleRepository,
  PgPlaybookRepository,
  PgPromptRepository,
  PgFeedbackRepository,
  RedisCacheClient,
} from '@aairp/infrastructure';
import { registerHealthController } from './controllers/health.controller.js';
import { registerAdvertisementUploadController } from './controllers/advertisement-upload.controller.js';
import { registerReviewContextController } from './controllers/review-context.controller.js';
import { registerRuleEvaluationController } from './controllers/rule-evaluation.controller.js';
import { registerPlaybookEvaluationController } from './controllers/playbook-evaluation.controller.js';
import { registerOpenRiskDiscoveryController } from './controllers/open-risk-discovery.controller.js';
import { registerDecisionController } from './controllers/decision.controller.js';
import { registerReviewReportController } from './controllers/review-report.controller.js';
import { registerDemoReviewController } from './controllers/demo-review.controller.js';
import { registerCaseAdminController } from './controllers/case-admin.controller.js';
import { registerKosRoutes } from './kos/register-kos-routes.js';
import { registerErrorHandler, registerTraceMiddleware } from './middleware/http.js';
import { registerDemoUi } from './register-demo-ui.js';

export type ApiConfig = {
  serviceName: string;
  version: string;
  host: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
};

export function loadApiConfig(): ApiConfig {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  if (!redisUrl) {
    throw new Error('REDIS_URL is required');
  }

  return {
    serviceName: process.env.SERVICE_NAME ?? 'aairp-api',
    version: process.env.APP_VERSION ?? '0.1.0-sprint1.5',
    host: process.env.HOST ?? '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
    databaseUrl,
    redisUrl,
  };
}

export async function buildApp(config: ApiConfig) {
  const app = Fastify({
    logger: true,
    bodyLimit: 256 * 1024,
  });

  registerTraceMiddleware(app);
  registerErrorHandler(app);

  const pool = new Pool({ connectionString: config.databaseUrl });
  const redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  const pgDb = new PgDatabaseClient(pool);

  app.addHook('onClose', async () => {
    await pool.end();
    redis.disconnect();
  });

  const healthRepository = new HealthRepository(
    pgDb,
    new RedisCacheClient(redis),
  );
  const healthService = new HealthService(healthRepository, {
    serviceName: config.serviceName,
    version: config.version,
  });

  await registerHealthController(app, { healthService });
  await registerDemoUi(app);

  const advertisementRepository = new InMemoryAdvertisementRepository();
  const advertisementUploadService = new AdvertisementUploadService(
    advertisementRepository,
    { defaultTenantId: process.env.DEFAULT_TENANT_ID ?? 'demo' },
  );

  const jsonCaseStore = new JsonCaseStore({ rootPath: resolveCaseLibraryRoot() });
  const pgCaseKosRepository = new PgCaseKosRepository(pgDb);
  const kosCaseStore = new KosCaseStoreAdapter(pgCaseKosRepository);
  const caseStorageMode = resolveCaseStorageMode();
  const auditLogRepository = new PgAuditLogRepository(pgDb);
  const auditLogService = new AuditLogService(auditLogRepository);

  let caseStore: ICaseStore = jsonCaseStore;
  if (caseStorageMode === 'kos') {
    caseStore = kosCaseStore;
  } else if (caseStorageMode === 'dual') {
    caseStore = new DualWriteCaseStore({
      primary: jsonCaseStore,
      secondary: kosCaseStore,
      log: (message, context) => {
        app.log.warn(context ?? {}, message);
      },
    });
  }

  const pgRuleRepository = new PgRuleRepository(pgDb);
  const pgPlaybookRepository = new PgPlaybookRepository(pgDb);
  const pgPromptRepository = new PgPromptRepository(pgDb);

  const pgCaseEmbeddingRepository = new PgCaseEmbeddingRepository(pgDb);

  const reviewRuntime = await bootstrapReviewRuntime(advertisementRepository, {
    ruleRepository: pgRuleRepository,
    playbookRepository: pgPlaybookRepository,
    promptRepository: pgPromptRepository,
    caseStore,
    caseEmbeddingRepository: pgCaseEmbeddingRepository,
  });

  if (reviewRuntime.knowledgeSnapshot) {
    app.log.info(
      {
        knowledgeSource: reviewRuntime.knowledgeSnapshot.source,
        rulePackVersion: reviewRuntime.knowledgeSnapshot.versions.rulePackVersion,
        caseFirstEnabled: Boolean(reviewRuntime.caseRetrievalService),
      },
      'review runtime knowledge loaded',
    );
  }

  const {
    contextBuilderService,
    ruleEngineService,
    playbookEngineService,
    reviewPipelineService,
  } = reviewRuntime;

  const reviewHappyPathService = new ReviewHappyPathService({
    advertisementUploadService,
    contextBuilderService,
    reviewPipelineService,
  });

  const caseKosAdminService = new CaseKosAdminService(
    pgCaseKosRepository,
    auditLogService,
  );
  const caseBuilderService = new CaseBuilderService({
    pipelineVersion: config.version,
  });
  const caseRecorderService = new CaseRecorderService({
    caseBuilderService,
    caseStore,
    log: (message, context) => {
      app.log.warn(context ?? {}, message);
    },
  });
  const caseSearchService = new CaseSearchService(caseStore);
  const caseExportService = new CaseExportService(caseStore);
  const kosSearchService = new KosSearchService(
    new PgKosSearchRepository(pgDb),
    caseStore,
  );
  const kosPublishService = new KosPublishService(
    new PgKosPublishRepository(pgDb, auditLogRepository),
  );
  const regulationAdminService = new RegulationAdminService(
    new PgRegulationRepository(pgDb),
    kosPublishService,
    auditLogService,
  );
  const ruleAdminService = new RuleAdminService(
    pgRuleRepository,
    kosPublishService,
    auditLogService,
  );
  const playbookAdminService = new PlaybookAdminService(
    pgPlaybookRepository,
    kosPublishService,
    auditLogService,
  );
  const promptAdminService = new PromptAdminService(
    pgPromptRepository,
    kosPublishService,
    auditLogService,
  );
  const feedbackAdminService = new FeedbackAdminService(
    new PgFeedbackRepository(pgDb),
    auditLogService,
  );

  await registerAdvertisementUploadController(app, { advertisementUploadService });
  await registerReviewContextController(app, { contextBuilderService });
  await registerRuleEvaluationController(app, {
    contextBuilderService,
    ruleEngineService,
  });
  await registerPlaybookEvaluationController(app, {
    contextBuilderService,
    playbookEngineService,
  });
  await registerOpenRiskDiscoveryController(app, {
    contextBuilderService,
    reviewPipelineService,
  });
  await registerDecisionController(app, {
    contextBuilderService,
    reviewPipelineService,
  });
  await registerReviewReportController(app, {
    contextBuilderService,
    reviewPipelineService,
  });
  await registerDemoReviewController(app, {
    reviewHappyPathService,
    caseRecorderService,
  });

  await registerCaseAdminController(app, {
    caseSearchService,
    caseExportService,
    caseStore,
  });

  await registerKosRoutes(app, {
    serviceName: `${config.serviceName}-kos`,
    version: config.version,
    kosSearchService,
    kosPublishService,
    regulationAdminService,
    ruleAdminService,
    playbookAdminService,
    promptAdminService,
    caseKosAdminService,
    feedbackAdminService,
    auditLogService,
  });

  return app;
}

export async function startServer(config: ApiConfig) {
  const app = await buildApp(config);
  await app.listen({ host: config.host, port: config.port });
  return app;
}
