import type { IAdvertisementRepository } from '@aairp/domain';
import type {
  ICaseEmbeddingRepository,
  ICaseStore,
  IPlaybookRepository,
  IPromptRepository,
  IRuleRepository,
  RuntimeKnowledgeSnapshot,
} from '@aairp/shared-kernel';
import { isCaseFirstEnabled, resolveKnowledgeSource } from '@aairp/shared-kernel';
import { CaseContextAssembler } from '../case/case-context-assembler.service.js';
import { CaseFindingGeneratorService } from '../case/case-finding-generator.service.js';
import { CaseRetrievalService } from '../case/case-retrieval.service.js';
import { DeterministicHashEmbeddingProvider } from '../case/deterministic-hash-embedding.provider.js';
import { ContextBuilderService, DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import { DecisionEngineService } from '../review/decision-engine.service.js';
import { OpenRiskDiscoveryService } from '../review/open-risk-discovery.service.js';
import { PlaybookEngineService } from '../review/playbook-engine.service.js';
import { ReviewPipelineService } from '../review/review-pipeline.service.js';
import { ReviewReportService } from '../review/review-report.service.js';
import { RuleEngineService } from '../review/rule-engine.service.js';
import { createKnowledgeGateway } from './knowledge-gateway.factory.js';
import { createReviewEnginesFromSnapshot } from './review-runtime.factory.js';

export type BootstrapReviewRuntimeDeps = {
  ruleRepository?: IRuleRepository;
  playbookRepository?: IPlaybookRepository;
  promptRepository?: IPromptRepository;
  caseStore?: ICaseStore;
  caseEmbeddingRepository?: ICaseEmbeddingRepository;
};

export type BootstrapReviewRuntimeResult = {
  contextBuilderService: ContextBuilderService;
  ruleEngineService: RuleEngineService;
  playbookEngineService: PlaybookEngineService;
  openRiskDiscoveryService: OpenRiskDiscoveryService;
  decisionEngineService: DecisionEngineService;
  reviewReportService: ReviewReportService;
  reviewPipelineService: ReviewPipelineService;
  knowledgeSnapshot?: RuntimeKnowledgeSnapshot;
  caseRetrievalService?: CaseRetrievalService;
};

export async function bootstrapReviewRuntime(
  advertisementRepository: IAdvertisementRepository,
  deps: BootstrapReviewRuntimeDeps = {},
): Promise<BootstrapReviewRuntimeResult> {
  const gateway = createKnowledgeGateway(resolveKnowledgeSource(), deps);
  const knowledgeSnapshot = await gateway.loadSnapshot();

  const contextBuilderService = new ContextBuilderService(advertisementRepository, {
    knowledgeVersions: knowledgeSnapshot.versions ?? DEMO_KNOWLEDGE_VERSIONS,
  });

  const engines = createReviewEnginesFromSnapshot(knowledgeSnapshot);

  const decisionEngineService = new DecisionEngineService();
  const reviewReportService = new ReviewReportService();
  const embeddingProvider = new DeterministicHashEmbeddingProvider();
  const caseRetrievalService =
    isCaseFirstEnabled() && deps.caseStore
      ? new CaseRetrievalService(
          deps.caseStore,
          {},
          {
            embeddingRepository: deps.caseEmbeddingRepository,
            embeddingProvider,
          },
        )
      : undefined;
  const caseContextAssembler =
    deps.caseStore && isCaseFirstEnabled() ? new CaseContextAssembler(deps.caseStore) : undefined;
  const caseFindingGeneratorService = isCaseFirstEnabled()
    ? new CaseFindingGeneratorService()
    : undefined;

  const reviewPipelineService = new ReviewPipelineService({
    ...engines,
    decisionEngineService,
    reviewReportService,
    caseRetrievalService,
    caseContextAssembler,
    caseFindingGeneratorService,
  });

  return {
    contextBuilderService,
    ...engines,
    decisionEngineService,
    reviewReportService,
    reviewPipelineService,
    knowledgeSnapshot,
    caseRetrievalService,
  };
}
