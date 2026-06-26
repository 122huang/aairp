import { readFile } from 'node:fs/promises';
import type {
  IPlaybookRepository,
  IPromptRepository,
  IRegulationRepository,
  IRuleRepository,
  RuleVersion,
} from '@aairp/shared-kernel';
import { parsePlaybookMarkdown } from '../review/playbook-engine.service.js';
import {
  DEMO_OPEN_RISK_TEMPLATE_KEY,
  DEMO_PLAYBOOK_PACK_KEY,
  DEMO_PROMPT_PACK_KEY,
  DEMO_REGULATION_SEEDS,
  DEMO_RULE_PACK_KEY,
  type DemoKnowledgePaths,
} from './demo-knowledge-paths.js';
import type {
  DemoRuleEntry,
  DemoRulesFile,
  KosDemoImportItemResult,
  KosDemoImportResult,
} from './demo-knowledge.types.js';
import type { KosPublishService } from './kos-publish.service.js';

export type KosDemoImportDeps = {
  ruleRepository: IRuleRepository;
  playbookRepository: IPlaybookRepository;
  promptRepository: IPromptRepository;
  regulationRepository: IRegulationRepository;
  publishService: KosPublishService;
  paths: DemoKnowledgePaths;
  readText?: (path: string) => Promise<string>;
};

function buildRulePayload(entry: DemoRuleEntry): Record<string, unknown> {
  return {
    demo_rule_version_id: entry.rule_version_id,
    ...(entry.forbidden_terms ? { forbidden_terms: entry.forbidden_terms } : {}),
    ...(entry.trigger_terms ? { trigger_terms: entry.trigger_terms } : {}),
    ...(entry.required_any_terms ? { required_any_terms: entry.required_any_terms } : {}),
    ...(entry.citation ? { citation: entry.citation } : {}),
  };
}

function isSameRuleVersion(published: RuleVersion, entry: DemoRuleEntry): boolean {
  const payload = published.payload;
  return (
    published.summary === entry.summary &&
    payload.demo_rule_version_id === entry.rule_version_id &&
    published.severity === entry.severity &&
    published.decision === entry.decision
  );
}

export class KosDemoImportService {
  constructor(private readonly deps: KosDemoImportDeps) {}

  async importAll(): Promise<KosDemoImportResult> {
    const regulations = await this.importRegulations();
    const rules = await this.importRules();
    const playbook = await this.importPlaybook();
    const prompt = await this.importPrompt();
    await this.linkDemoRuleRegulations();

    return { regulations, rules, playbook, prompt };
  }

  async importRegulations(): Promise<KosDemoImportItemResult[]> {
    const results: KosDemoImportItemResult[] = [];

    for (const seed of DEMO_REGULATION_SEEDS) {
      let regulation =
        (await this.deps.regulationRepository.getRegulationByKey(seed.regulationKey)) ??
        (await this.deps.regulationRepository.createRegulation({
          regulationKey: seed.regulationKey,
          jurisdiction: seed.jurisdiction,
        }));

      const publishedVersions = await this.deps.regulationRepository.listVersions(
        regulation.regulationId,
        'PUBLISHED',
      );
      const existing = publishedVersions.find(
        (version) =>
          version.lawName === seed.lawName &&
          version.article === seed.article &&
          version.bodyText === seed.bodyText,
      );
      if (existing) {
        results.push({
          objectType: 'regulation',
          key: seed.regulationKey,
          action: 'skipped',
          versionId: existing.regulationVersionId,
        });
        continue;
      }

      const draft = await this.deps.regulationRepository.createVersion({
        regulationId: regulation.regulationId,
        lawName: seed.lawName,
        article: seed.article,
        bodyText: seed.bodyText,
        tags: seed.tags ?? ['demo', 'imported'],
        searchText: [seed.lawName, seed.article, seed.bodyText].filter(Boolean).join(' '),
      });

      const published = await this.deps.publishService.publish(
        'regulation',
        draft.regulationVersionId,
        { actor: 'kos:import-demo' },
      );

      results.push({
        objectType: 'regulation',
        key: seed.regulationKey,
        action: 'published',
        versionId: published.versionId,
      });
    }

    return results;
  }

  private async linkDemoRuleRegulations(): Promise<void> {
    const pack = await this.deps.ruleRepository.getPackByKey(DEMO_RULE_PACK_KEY);
    if (!pack) {
      return;
    }

    const rule = await this.deps.ruleRepository.getRuleByPackAndKey(
      pack.rulePackId,
      'demo-sg-health-forbidden-claim',
    );
    if (!rule) {
      return;
    }

    const ruleVersions = await this.deps.ruleRepository.listVersions(rule.ruleId, 'PUBLISHED');
    const ruleVersion = ruleVersions[0];
    if (!ruleVersion) {
      return;
    }

    const regulation = await this.deps.regulationRepository.getRegulationByKey('sg-hpa-s7');
    if (!regulation) {
      return;
    }

    const regulationVersions = await this.deps.regulationRepository.listVersions(
      regulation.regulationId,
      'PUBLISHED',
    );
    const regulationVersion = regulationVersions[0];
    if (!regulationVersion) {
      return;
    }

    await this.deps.regulationRepository.linkRuleVersion(
      ruleVersion.ruleVersionId,
      regulationVersion.regulationVersionId,
    );
  }

  async importRules(): Promise<KosDemoImportItemResult[]> {
    const readText = this.deps.readText ?? ((path: string) => readFile(path, 'utf8'));
    const raw = await readText(this.deps.paths.rulesJson);
    const file = JSON.parse(raw) as DemoRulesFile;

    let pack =
      (await this.deps.ruleRepository.getPackByKey(DEMO_RULE_PACK_KEY)) ??
      (await this.deps.ruleRepository.createPack({
        packKey: DEMO_RULE_PACK_KEY,
        name: 'Demo Rule Pack',
        description: `Imported from demo/rules.demo.json (${file.pack_version})`,
      }));

    const results: KosDemoImportItemResult[] = [];

    for (const entry of file.rules) {
      let rule =
        (await this.deps.ruleRepository.getRuleByPackAndKey(pack.rulePackId, entry.rule_id)) ??
        (await this.deps.ruleRepository.createRule({
          rulePackId: pack.rulePackId,
          ruleKey: entry.rule_id,
          displayName: entry.rule_id,
        }));

      const publishedVersions = await this.deps.ruleRepository.listVersions(
        rule.ruleId,
        'PUBLISHED',
      );
      const existing = publishedVersions.find((version) => isSameRuleVersion(version, entry));
      if (existing) {
        results.push({
          objectType: 'rule',
          key: entry.rule_id,
          action: 'skipped',
          versionId: existing.ruleVersionId,
        });
        continue;
      }

      const draft = await this.deps.ruleRepository.createVersion({
        ruleId: rule.ruleId,
        severity: entry.severity,
        decision: entry.decision,
        summary: entry.summary,
        scope: {
          countries: entry.scopes.countries,
          categories: entry.scopes.categories,
        },
        payload: buildRulePayload(entry),
        tags: ['demo', 'imported'],
      });

      const published = await this.deps.publishService.publish('rule', draft.ruleVersionId, {
        actor: 'kos:import-demo',
      });

      results.push({
        objectType: 'rule',
        key: entry.rule_id,
        action: 'published',
        versionId: published.versionId,
      });
    }

    return results;
  }

  async importPlaybook(): Promise<KosDemoImportItemResult> {
    const readText = this.deps.readText ?? ((path: string) => readFile(path, 'utf8'));
    const markdown = await readText(this.deps.paths.playbookMarkdown);
    const parsed = parsePlaybookMarkdown(markdown);
    const packKey = parsed.playbookId || DEMO_PLAYBOOK_PACK_KEY;

    let pack =
      (await this.deps.playbookRepository.getPackByKey(packKey)) ??
      (await this.deps.playbookRepository.createPack({
        packKey,
        name: 'Demo Health Supplement Playbook',
        description: `Imported from demo/playbook.demo.md (${parsed.packVersion})`,
      }));

    const publishedVersions = (
      await this.deps.playbookRepository.listPackVersions(pack.playbookPackId)
    ).filter((version) => version.status === 'PUBLISHED');

    if (publishedVersions.length > 0) {
      const latest = publishedVersions[0]!;
      const patterns = await this.deps.playbookRepository.listPatterns(
        latest.playbookVersionId,
      );
      const existingRefIds = patterns.map((pattern) => pattern.refId).sort();
      const expectedRefIds = parsed.items.map((item) => item.patternId).sort();

      if (
        existingRefIds.length === expectedRefIds.length &&
        existingRefIds.every((refId, index) => refId === expectedRefIds[index])
      ) {
        return {
          objectType: 'playbook',
          key: packKey,
          action: 'skipped',
          versionId: latest.playbookVersionId,
        };
      }
    }

    const draft = await this.deps.playbookRepository.createVersion({
      playbookPackId: pack.playbookPackId,
    });

    for (const item of parsed.items) {
      await this.deps.playbookRepository.createPattern({
        playbookVersionId: draft.playbookVersionId,
        refId: item.patternId,
        matchType: 'terms',
        terms: item.triggerKeywords,
        guidance: item.guidance,
        markdownBody: [
          `severity_hint: ${item.severityHint}`,
          `decision: ${item.playbookDecision}`,
          `typical_decision: ${item.typicalDecision}`,
        ].join('\n'),
      });
    }

    const published = await this.deps.publishService.publish(
      'playbook',
      draft.playbookVersionId,
      { actor: 'kos:import-demo' },
    );

    return {
      objectType: 'playbook',
      key: packKey,
      action: 'published',
      versionId: published.versionId,
    };
  }

  async importPrompt(): Promise<KosDemoImportItemResult> {
    const readText = this.deps.readText ?? ((path: string) => readFile(path, 'utf8'));
    const content = await readText(this.deps.paths.openRiskPrompt);

    let pack =
      (await this.deps.promptRepository.getPackByKey(DEMO_PROMPT_PACK_KEY)) ??
      (await this.deps.promptRepository.createPack({
        packKey: DEMO_PROMPT_PACK_KEY,
        name: 'Demo Open Risk Prompt Pack',
        description: 'Imported from demo/open-risk.prompt.txt',
      }));

    let template =
      (await this.deps.promptRepository.getTemplateByPackAndKey(
        pack.promptPackId,
        DEMO_OPEN_RISK_TEMPLATE_KEY,
      )) ??
      (await this.deps.promptRepository.createTemplate({
        promptPackId: pack.promptPackId,
        templateKey: DEMO_OPEN_RISK_TEMPLATE_KEY,
        templateType: 'open_risk',
      }));

    const publishedVersions = (await this.deps.promptRepository.listVersions(template.templateId))
      .filter((version) => version.status === 'PUBLISHED');

    const existing = publishedVersions.find((version) => version.content === content);
    if (existing) {
      return {
        objectType: 'prompt',
        key: DEMO_OPEN_RISK_TEMPLATE_KEY,
        action: 'skipped',
        versionId: existing.promptVersionId,
      };
    }

    const draft = await this.deps.promptRepository.createVersion({
      templateId: template.templateId,
      content,
      schemaVersion: 'demo-open-risk-1.1.0',
      tags: ['demo', 'imported'],
    });

    const published = await this.deps.publishService.publish('prompt', draft.promptVersionId, {
      actor: 'kos:import-demo',
    });

    return {
      objectType: 'prompt',
      key: DEMO_OPEN_RISK_TEMPLATE_KEY,
      action: 'published',
      versionId: published.versionId,
    };
  }
}
