import type { ResolvedKnowledgeVersions } from '../context/resolved-knowledge-versions.js';
import type { FindingCitation } from '../findings/finding-types.js';

export type RuntimeRuleScope = {
  countries: string[];
  categories: string[];
};

export type RuleWhenCondition = {
  has_images?: boolean;
  ai_rendered_image?: boolean;
  /** OCR or ad text contains CJK characters (localization signal) */
  ocr_contains_cjk?: boolean;
  /** Pipeline flag: certification badge in image is unreadable */
  certification_image_unreadable?: boolean;
  /** Pipeline flag: AI-rendered image has visible quality defects */
  ai_image_quality_issue?: boolean;
  /**
   * Singapore CPSR: category is an appliance class that must complete SAFETY Mark
   * registration before advertising. Used with empty term matchers + scopes.
   */
  category_requires_cpsr?: boolean;
  /**
   * Malaysia EECA: category is an energy-using product that must complete COE
   * before advertising. Used with empty term matchers + scopes.
   */
  category_requires_coe?: boolean;
  /** Audience targeting includes children (AANA / similar code routes). */
  audience_includes_children?: boolean;
};

export type RuntimeRuleCountryDecisionOverride = {
  decision?: string;
  severity?: string;
};

/** Rule-level override (VN) or term-keyed overrides (TH). */
export type RuntimeRuleCountryOverride = RuntimeRuleCountryDecisionOverride &
  Record<string, RuntimeRuleCountryDecisionOverride | string | undefined>;

export type RuntimeRuleDefinition = {
  rule_id: string;
  rule_version_id: string;
  severity: string;
  decision: string;
  summary: string;
  scopes: RuntimeRuleScope;
  forbidden_terms?: string[];
  trigger_terms?: string[];
  required_any_terms?: string[];
  when?: RuleWhenCondition;
  sku_mismatch_check?: boolean;
  citation?: FindingCitation;
  country_decision_overrides?: Record<string, RuntimeRuleCountryOverride>;
};

export type RuntimeRulePack = {
  pack_version: string;
  rules: RuntimeRuleDefinition[];
};

export type RuntimePlaybookPack = {
  pack_version: string;
  playbook_id: string;
  markdown: string;
};

export type RuntimePromptTemplate = {
  pack_version: string;
  template_key: string;
  content: string;
};

export type RuntimeKnowledgeSnapshot = {
  versions: ResolvedKnowledgeVersions;
  rulePack: RuntimeRulePack;
  playbook: RuntimePlaybookPack;
  openRiskPrompt: RuntimePromptTemplate;
  source: 'demo' | 'kos';
};

export type IKnowledgeGateway = {
  loadSnapshot(): Promise<RuntimeKnowledgeSnapshot>;
};

export type KnowledgeSource = 'demo' | 'kos';

export function resolveKnowledgeSource(): KnowledgeSource {
  const raw = process.env.AAIRP_KNOWLEDGE_SOURCE?.toLowerCase();
  return raw === 'kos' ? 'kos' : 'demo';
}

export function isCaseFirstEnabled(): boolean {
  const flag = process.env.AAIRP_CASE_FIRST_ENABLED;
  if (flag === undefined) {
    return false;
  }
  return flag !== '0' && flag.toLowerCase() !== 'false';
}

export function isCaseGroundLlmEnabled(): boolean {
  if (!isCaseFirstEnabled()) {
    return false;
  }
  const flag = process.env.AAIRP_CASE_GROUND_LLM;
  if (flag === undefined) {
    return true;
  }
  return flag !== '0' && flag.toLowerCase() !== 'false';
}

export function isCaseSkipLlmOnExactHash(): boolean {
  if (!isCaseFirstEnabled()) {
    return false;
  }
  const flag = process.env.AAIRP_CASE_SKIP_LLM_ON_EXACT_HASH;
  if (flag === undefined) {
    return false;
  }
  return flag !== '0' && flag.toLowerCase() !== 'false';
}

export function isCaseInPlaybookEnabled(): boolean {
  if (!isCaseFirstEnabled()) {
    return false;
  }
  const flag = process.env.AAIRP_CASE_IN_PLAYBOOK;
  if (flag === undefined) {
    return true;
  }
  return flag !== '0' && flag.toLowerCase() !== 'false';
}

export function isCaseFindingsInDecisionEnabled(): boolean {
  if (!isCaseFirstEnabled()) {
    return false;
  }
  const flag = process.env.AAIRP_CASE_FINDINGS_IN_DECISION;
  if (flag === undefined) {
    return false;
  }
  return flag !== '0' && flag.toLowerCase() !== 'false';
}

export {
  DEFAULT_CASE_EMBEDDING_DIMENSIONS,
  DEFAULT_CASE_EMBEDDING_MODEL,
  isCaseVectorRetrievalEnabled,
  resolveCaseEmbeddingModel,
} from '../case/case-embedding.js';
