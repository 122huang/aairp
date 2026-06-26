import type {
  IKnowledgeGateway,
  IPlaybookRepository,
  IPromptRepository,
  IRuleRepository,
  KnowledgeSource,
} from '@aairp/shared-kernel';
import { resolveKnowledgeSource } from '@aairp/shared-kernel';
import { DemoKnowledgeGateway } from './demo-knowledge-gateway.js';
import { PgKosKnowledgeGateway } from './pg-kos-knowledge-gateway.js';

export type KnowledgeGatewayFactoryDeps = {
  ruleRepository?: IRuleRepository;
  playbookRepository?: IPlaybookRepository;
  promptRepository?: IPromptRepository;
};

export function createKnowledgeGateway(
  source: KnowledgeSource = resolveKnowledgeSource(),
  deps: KnowledgeGatewayFactoryDeps = {},
): IKnowledgeGateway {
  if (source === 'kos' && deps.ruleRepository && deps.playbookRepository && deps.promptRepository) {
    return new PgKosKnowledgeGateway({
      ruleRepository: deps.ruleRepository,
      playbookRepository: deps.playbookRepository,
      promptRepository: deps.promptRepository,
      fallback: new DemoKnowledgeGateway(),
    });
  }
  return new DemoKnowledgeGateway();
}
