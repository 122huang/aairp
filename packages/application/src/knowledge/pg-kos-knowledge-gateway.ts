import type {
  IKnowledgeGateway,
  IPlaybookRepository,
  IPromptRepository,
  IRuleRepository,
  RuntimeKnowledgeSnapshot,
  RuntimeRuleDefinition,
  RuntimeRulePack,
} from '@aairp/shared-kernel';
import { DEMO_KNOWLEDGE_VERSIONS } from '../review/context-builder.service.js';
import { parsePlaybookMarkdown } from '../review/playbook-engine.service.js';
import {
  DEMO_KNOWLEDGE_PACK_KEYS,
  DemoKnowledgeGateway,
} from './demo-knowledge-gateway.js';

export type PgKosKnowledgeGatewayDeps = {
  ruleRepository: IRuleRepository;
  playbookRepository: IPlaybookRepository;
  promptRepository: IPromptRepository;
  fallback?: IKnowledgeGateway;
};

function mapRuleExportToRuntime(packVersion: string, rules: RuntimeRuleDefinition[]): RuntimeRulePack {
  return { pack_version: packVersion, rules };
}

function mapExportRules(
  bundle: NonNullable<Awaited<ReturnType<IRuleRepository['exportPack']>>>,
): RuntimeRulePack {
  return mapRuleExportToRuntime(bundle.pack_version, bundle.rules.map((rule) => ({
    rule_id: rule.rule_id,
    rule_version_id: rule.rule_version_id,
    severity: rule.severity,
    decision: rule.decision,
    summary: rule.summary,
    scopes: rule.scopes,
    forbidden_terms: rule.forbidden_terms,
    trigger_terms: rule.trigger_terms,
    required_any_terms: rule.required_any_terms,
    citation: rule.citation
      ? { lawName: rule.citation.law_name, article: rule.citation.article }
      : undefined,
  })));
}

export class PgKosKnowledgeGateway implements IKnowledgeGateway {
  private readonly fallback: IKnowledgeGateway;

  constructor(private readonly deps: PgKosKnowledgeGatewayDeps) {
    this.fallback = deps.fallback ?? new DemoKnowledgeGateway();
  }

  async loadSnapshot(): Promise<RuntimeKnowledgeSnapshot> {
    const rulePack = await this.loadRulePack();
    const playbook = await this.loadPlaybook();
    const openRiskPrompt = await this.loadOpenRiskPrompt();

    if (!rulePack || !playbook || !openRiskPrompt) {
      const fallbackSnapshot = await this.fallback.loadSnapshot();
      return { ...fallbackSnapshot, source: 'demo' };
    }

    const parsedPlaybook = parsePlaybookMarkdown(playbook.markdown);

    return {
      source: 'kos',
      versions: {
        rulePackVersion: rulePack.pack_version,
        policyPackVersion: DEMO_KNOWLEDGE_VERSIONS.policyPackVersion,
        playbookPackVersion: parsedPlaybook.packVersion,
      },
      rulePack,
      playbook: {
        pack_version: parsedPlaybook.packVersion,
        playbook_id: parsedPlaybook.playbookId,
        markdown: playbook.markdown,
      },
      openRiskPrompt,
    };
  }

  private async loadRulePack(): Promise<RuntimeRulePack | null> {
    const pack = await this.deps.ruleRepository.getPackByKey(DEMO_KNOWLEDGE_PACK_KEYS.rulePackKey);
    if (!pack) {
      return null;
    }
    const exported = await this.deps.ruleRepository.exportPack(pack.rulePackId);
    if (!exported || exported.rules.length === 0) {
      return null;
    }
    return mapExportRules(exported);
  }

  private async loadPlaybook(): Promise<{ markdown: string } | null> {
    const pack = await this.deps.playbookRepository.getPackByKey(
      DEMO_KNOWLEDGE_PACK_KEYS.playbookPackKey,
    );
    if (!pack) {
      return null;
    }
    const exported = await this.deps.playbookRepository.exportMarkdown(pack.playbookPackId);
    if (!exported?.markdown) {
      return null;
    }
    return { markdown: exported.markdown };
  }

  private async loadOpenRiskPrompt(): Promise<RuntimeKnowledgeSnapshot['openRiskPrompt'] | null> {
    const pack = await this.deps.promptRepository.getPackByKey(DEMO_KNOWLEDGE_PACK_KEYS.promptPackKey);
    if (!pack) {
      return null;
    }
    const template = await this.deps.promptRepository.getTemplateByPackAndKey(
      pack.promptPackId,
      DEMO_KNOWLEDGE_PACK_KEYS.openRiskTemplateKey,
    );
    if (!template) {
      return null;
    }
    const exported = await this.deps.promptRepository.exportPublishedContent(template.templateId);
    if (!exported?.content) {
      return null;
    }
    return {
      pack_version: 'demo-open-risk-1.1.0',
      template_key: exported.template_key,
      content: exported.content,
    };
  }
}
