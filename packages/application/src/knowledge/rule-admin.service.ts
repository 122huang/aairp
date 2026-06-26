import type {
  CreateRuleInput,
  CreateRulePackInput,
  CreateRuleVersionInput,
  IRuleRepository,
  PackVersionStatus,
  PaginationParams,
  RulePackExportBundle,
  UpdateRuleVersionInput,
} from '@aairp/shared-kernel';
import { AuditLogService } from './audit-log.service.js';
import type { KosPublishService } from './kos-publish.service.js';

export type AdminContext = {
  actor?: string;
  traceId?: string;
};

export class RuleAdminService {
  constructor(
    private readonly ruleRepository: IRuleRepository,
    private readonly publishService: KosPublishService,
    private readonly auditLogService: AuditLogService,
  ) {}

  listPacks(params: PaginationParams, _ctx?: AdminContext) {
    return this.ruleRepository.listPacks(params);
  }

  async createPack(input: CreateRulePackInput, ctx?: AdminContext) {
    const pack = await this.ruleRepository.createPack(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'rule_pack',
      resourceId: pack.rulePackId,
      payload: { packKey: pack.packKey },
    });
    return pack;
  }

  getPack(rulePackId: string) {
    return this.ruleRepository.getPackById(rulePackId);
  }

  listRules(rulePackId: string, params: PaginationParams) {
    return this.ruleRepository.listRules(rulePackId, params);
  }

  async createRule(input: CreateRuleInput, ctx?: AdminContext) {
    const rule = await this.ruleRepository.createRule(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'rule',
      resourceId: rule.ruleId,
      payload: { ruleKey: rule.ruleKey },
    });
    return rule;
  }

  getRule(ruleId: string) {
    return this.ruleRepository.getRuleById(ruleId);
  }

  listVersions(ruleId: string, status?: PackVersionStatus) {
    return this.ruleRepository.listVersions(ruleId, status);
  }

  getVersion(ruleVersionId: string) {
    return this.ruleRepository.getVersionById(ruleVersionId);
  }

  async createVersion(input: CreateRuleVersionInput, ctx?: AdminContext) {
    const version = await this.ruleRepository.createVersion(input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'CREATE',
      resourceType: 'rule_version',
      resourceId: version.ruleVersionId,
      payload: { ruleId: version.ruleId, versionNumber: version.versionNumber },
    });
    return version;
  }

  async updateVersion(
    ruleVersionId: string,
    input: UpdateRuleVersionInput,
    ctx?: AdminContext,
  ) {
    const version = await this.ruleRepository.updateVersion(ruleVersionId, input);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'UPDATE',
      resourceType: 'rule_version',
      resourceId: version.ruleVersionId,
      payload: { ruleId: version.ruleId, versionNumber: version.versionNumber },
    });
    return version;
  }

  async publishVersion(ruleVersionId: string, ctx?: AdminContext) {
    await this.publishService.publish('rule', ruleVersionId, ctx);
    const version = await this.ruleRepository.getVersionById(ruleVersionId);
    if (!version) {
      throw new Error(`rule version not found after publish: ${ruleVersionId}`);
    }
    return version;
  }

  async rollbackVersion(ruleVersionId: string, ctx?: AdminContext) {
    await this.publishService.rollback('rule', ruleVersionId, ctx);
    const version = await this.ruleRepository.getVersionById(ruleVersionId);
    if (!version) {
      throw new Error(`rule version not found after rollback: ${ruleVersionId}`);
    }
    return version;
  }

  listRegulationVersionIds(ruleVersionId: string) {
    return this.ruleRepository.listRegulationVersionIds(ruleVersionId);
  }

  async setRegulationVersionLinks(
    ruleVersionId: string,
    regulationVersionIds: string[],
    ctx?: AdminContext,
  ) {
    await this.ruleRepository.setRegulationVersionLinks(ruleVersionId, regulationVersionIds);
    await this.auditLogService.record({
      actor: ctx?.actor,
      traceId: ctx?.traceId,
      action: 'UPDATE',
      resourceType: 'rule_version',
      resourceId: ruleVersionId,
      payload: { regulation_version_ids: regulationVersionIds },
    });
  }

  exportPack(rulePackId: string): Promise<RulePackExportBundle | null> {
    return this.ruleRepository.exportPack(rulePackId);
  }
}
