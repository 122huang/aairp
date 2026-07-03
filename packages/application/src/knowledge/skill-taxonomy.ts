/**
 * @deprecated Import from skill-modules.js — skill-taxonomy.json is superseded by skill-modules.json
 */
export {
  loadSkillTaxonomy,
  loadSkillModules,
  listTaxonomyPatternIds,
  listModulePatternIds,
  patternIdToModule,
  getPatternMetadata,
  mapGoldenIssue,
  deriveExpectedAction,
  getModuleContract,
  resolveSkillModulesPath as resolveSkillTaxonomyPath,
} from './skill-modules.js';

export type {
  SkillTaxonomy,
  SkillModulesDocument,
  SkillModuleContract,
  SkillModulePattern,
  GoldenIssueMapping,
} from './skill-modules.js';

/** @deprecated Use SkillModulePattern */
export type SkillTaxonomyPattern = import('./skill-modules.js').SkillModulePattern;

/** @deprecated Use SkillModuleContract */
export type SkillTaxonomyModule = Pick<
  import('./skill-modules.js').SkillModuleContract,
  'skill_module' | 'description' | 'patterns'
>;
