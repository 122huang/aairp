import { describe, expect, it, vi, beforeEach } from 'vitest';
import type {
  IPlaybookRepository,
  IPromptRepository,
  IRegulationRepository,
  IRuleRepository,
} from '@aairp/shared-kernel';
import { KosDemoImportService } from './kos-demo-import.service.js';
import type { KosPublishService } from './kos-publish.service.js';

const demoRulesJson = JSON.stringify({
  pack_version: 'demo-rule-1.0.0',
  rules: [
    {
      rule_id: 'demo-sg-health-forbidden-claim',
      rule_version_id: 'demo-sg-health-forbidden-claim-v1',
      severity: 'BLOCKER',
      decision: 'FAIL',
      summary: 'Prohibited absolute health cure claims are not allowed',
      forbidden_terms: ['cure'],
      scopes: { countries: ['SG'], categories: ['health.supplement'] },
    },
  ],
});

const demoPlaybookMd = `# Demo

pack_version: demo-playbook-1.0.0
playbook_id: demo-health-supplement-playbook

## urgency-cta

trigger_keywords: buy now, act now
severity_hint: MEDIUM
decision: WARN
guidance: Urgency detected.
typical_decision: REVIEW
`;

const demoPrompt = 'You are an open-risk agent.\n';

function createRuleRepositoryMock(): IRuleRepository {
  return {
    listPacks: vi.fn(),
    createPack: vi.fn().mockResolvedValue({
      rulePackId: 'pack-1',
      packKey: 'demo-rules',
      name: 'Demo Rule Pack',
      createdAt: '',
      updatedAt: '',
    }),
    getPackById: vi.fn(),
    getPackByKey: vi.fn().mockResolvedValue(null),
    listRules: vi.fn(),
    createRule: vi.fn().mockResolvedValue({
      ruleId: 'rule-1',
      rulePackId: 'pack-1',
      ruleKey: 'demo-sg-health-forbidden-claim',
      createdAt: '',
      updatedAt: '',
    }),
    getRuleById: vi.fn(),
    getRuleByPackAndKey: vi.fn().mockResolvedValue(null),
    listVersions: vi.fn().mockResolvedValue([]),
    createVersion: vi.fn().mockResolvedValue({
      ruleVersionId: 'rv-1',
      ruleId: 'rule-1',
      versionNumber: 1,
      status: 'DRAFT',
      severity: 'BLOCKER',
      decision: 'FAIL',
      summary: 'Prohibited absolute health cure claims are not allowed',
      scope: { countries: ['SG'], categories: ['health.supplement'] },
      payload: {},
      tags: [],
      createdAt: '',
      updatedAt: '',
    }),
    getVersionById: vi.fn(),
    updateVersion: vi.fn(),
    listRegulationVersionIds: vi.fn(),
    setRegulationVersionLinks: vi.fn(),
    exportPack: vi.fn(),
  } as unknown as IRuleRepository;
}

function createPlaybookRepositoryMock(): IPlaybookRepository {
  return {
    listPacks: vi.fn(),
    createPack: vi.fn().mockResolvedValue({
      playbookPackId: 'pb-pack-1',
      packKey: 'demo-health-supplement-playbook',
      name: 'Demo Playbook',
      createdAt: '',
      updatedAt: '',
    }),
    getPackByKey: vi.fn().mockResolvedValue(null),
    getPackById: vi.fn(),
    listPackVersions: vi.fn().mockResolvedValue([]),
    getVersionById: vi.fn(),
    createVersion: vi.fn().mockResolvedValue({
      playbookVersionId: 'pb-v-1',
      playbookPackId: 'pb-pack-1',
      versionNumber: 1,
      status: 'DRAFT',
      createdAt: '',
      updatedAt: '',
    }),
    listPatterns: vi.fn().mockResolvedValue([]),
    getPatternById: vi.fn(),
    createPattern: vi.fn(),
    updatePattern: vi.fn(),
    exportMarkdown: vi.fn(),
  } as unknown as IPlaybookRepository;
}

function createPromptRepositoryMock(): IPromptRepository {
  return {
    listPacks: vi.fn(),
    createPack: vi.fn().mockResolvedValue({
      promptPackId: 'pr-pack-1',
      packKey: 'demo-open-risk',
      name: 'Demo Prompt',
      createdAt: '',
      updatedAt: '',
    }),
    getPackByKey: vi.fn().mockResolvedValue(null),
    getPackById: vi.fn(),
    listTemplates: vi.fn(),
    createTemplate: vi.fn().mockResolvedValue({
      templateId: 'tpl-1',
      promptPackId: 'pr-pack-1',
      templateKey: 'open-risk-discovery',
      templateType: 'open_risk',
      createdAt: '',
      updatedAt: '',
    }),
    getTemplateById: vi.fn(),
    getTemplateByPackAndKey: vi.fn().mockResolvedValue(null),
    listVersions: vi.fn().mockResolvedValue([]),
    getVersionById: vi.fn(),
    createVersion: vi.fn().mockResolvedValue({
      promptVersionId: 'pr-v-1',
      templateId: 'tpl-1',
      versionNumber: 1,
      status: 'DRAFT',
      content: demoPrompt,
      tags: [],
      createdAt: '',
      updatedAt: '',
    }),
    updateVersion: vi.fn(),
    getVersionContent: vi.fn(),
    exportPublishedContent: vi.fn(),
  } as unknown as IPromptRepository;
}

describe('KosDemoImportService', () => {
  let publishService: KosPublishService;
  let ruleRepository: IRuleRepository;
  let playbookRepository: IPlaybookRepository;
  let promptRepository: IPromptRepository;
  let regulationRepository: IRegulationRepository;

  beforeEach(() => {
    publishService = {
      publish: vi.fn().mockImplementation((_type, versionId) =>
        Promise.resolve({
          objectType: 'rule',
          versionId,
          parentId: 'parent',
          versionNumber: 1,
          status: 'PUBLISHED',
          publishedAt: '2026-06-26T10:00:00.000Z',
        }),
      ),
      rollback: vi.fn(),
    } as unknown as KosPublishService;
    ruleRepository = createRuleRepositoryMock();
    playbookRepository = createPlaybookRepositoryMock();
    promptRepository = createPromptRepositoryMock();
    regulationRepository = createRegulationRepositoryMock();
  });

  function createRegulationRepositoryMock(): IRegulationRepository {
    return {
      listRegulations: vi.fn(),
      createRegulation: vi.fn().mockResolvedValue({
        regulationId: 'reg-1',
        regulationKey: 'sg-hpa-s7',
        jurisdiction: 'SG',
        createdAt: '',
        updatedAt: '',
      }),
      getRegulationById: vi.fn(),
      getRegulationByKey: vi.fn().mockResolvedValue(null),
      listVersions: vi.fn().mockResolvedValue([]),
      getVersionById: vi.fn(),
      createVersion: vi.fn().mockResolvedValue({
        regulationVersionId: 'reg-v-1',
        regulationId: 'reg-1',
        versionNumber: 1,
        status: 'DRAFT',
        lawName: 'SG Health Products Act (Demo)',
        tags: [],
        createdAt: '',
        updatedAt: '',
      }),
      updateVersion: vi.fn(),
      linkRuleVersion: vi.fn(),
    } as unknown as IRegulationRepository;
  }

  function createService(readText: (path: string) => Promise<string>) {
    return new KosDemoImportService({
      ruleRepository,
      playbookRepository,
      promptRepository,
      regulationRepository,
      publishService,
      paths: {
        root: '/demo',
        rulesJson: '/demo/rules.demo.json',
        playbookMarkdown: '/demo/playbook.demo.md',
        openRiskPrompt: '/demo/open-risk.prompt.txt',
      },
      readText,
    });
  }

  it('imports rules and publishes draft versions', async () => {
    const service = createService(async (path) => {
      if (path.endsWith('rules.demo.json')) return demoRulesJson;
      if (path.endsWith('playbook.demo.md')) return demoPlaybookMd;
      return demoPrompt;
    });

    const result = await service.importAll();

    expect(result.rules).toHaveLength(1);
    expect(result.regulations).toHaveLength(3);
    expect(result.rules[0]?.action).toBe('published');
    expect(publishService.publish).toHaveBeenCalled();
    expect(result.playbook.action).toBe('published');
    expect(result.prompt.action).toBe('published');
  });

  it('skips rules when published version already matches demo', async () => {
    vi.mocked(ruleRepository.getPackByKey).mockResolvedValue({
      rulePackId: 'pack-1',
      packKey: 'demo-rules',
      name: 'Demo Rule Pack',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(ruleRepository.getRuleByPackAndKey).mockResolvedValue({
      ruleId: 'rule-1',
      rulePackId: 'pack-1',
      ruleKey: 'demo-sg-health-forbidden-claim',
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(ruleRepository.listVersions).mockResolvedValue([
      {
        ruleVersionId: 'rv-existing',
        ruleId: 'rule-1',
        versionNumber: 1,
        status: 'PUBLISHED',
        severity: 'BLOCKER',
        decision: 'FAIL',
        summary: 'Prohibited absolute health cure claims are not allowed',
        scope: { countries: ['SG'], categories: ['health.supplement'] },
        payload: { demo_rule_version_id: 'demo-sg-health-forbidden-claim-v1' },
        tags: [],
        createdAt: '',
        updatedAt: '',
      },
    ]);

    const service = createService(async (path) => {
      if (path.endsWith('rules.demo.json')) return demoRulesJson;
      throw new Error(`unexpected path ${path}`);
    });

    const result = await service.importRules();

    expect(result[0]?.action).toBe('skipped');
    expect(ruleRepository.createVersion).not.toHaveBeenCalled();
    expect(publishService.publish).not.toHaveBeenCalled();
  });
});
