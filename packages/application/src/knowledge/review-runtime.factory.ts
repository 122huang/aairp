import type { RuntimeKnowledgeSnapshot } from '@aairp/shared-kernel';
import { OpenRiskDiscoveryService } from '../review/open-risk-discovery.service.js';
import { PlaybookEngineService } from '../review/playbook-engine.service.js';
import { RuleEngineService } from '../review/rule-engine.service.js';

export type ReviewEnginesFromSnapshot = {
  ruleEngineService: RuleEngineService;
  playbookEngineService: PlaybookEngineService;
  openRiskDiscoveryService: OpenRiskDiscoveryService;
};

export function createReviewEnginesFromSnapshot(
  snapshot: RuntimeKnowledgeSnapshot,
): ReviewEnginesFromSnapshot {
  return {
    ruleEngineService: new RuleEngineService({ rulePack: snapshot.rulePack }),
    playbookEngineService: new PlaybookEngineService({
      playbookMarkdown: snapshot.playbook.markdown,
    }),
    openRiskDiscoveryService: new OpenRiskDiscoveryService({
      promptTemplate: snapshot.openRiskPrompt.content,
      promptPackVersion: snapshot.openRiskPrompt.pack_version,
    }),
  };
}
