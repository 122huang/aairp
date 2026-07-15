import type { ReviewContext, RuleWhenCondition } from '@aairp/shared-kernel';
import type { SearchableField } from './content-matching.js';
import { searchableFields } from './content-matching.js';

const MODEL_TOKEN_PATTERN =
  /\b(?=[A-Z0-9]*[A-Z])(?=[A-Z0-9]*\d)[A-Z0-9]{2,12}(?:-[A-Z0-9]{2,6})?\b/gi;

const CJK_PATTERN = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;

/**
 * Appliance / electronics categories under SG CPSR or MY EECA advertising prerequisites.
 * Static category membership only (not live SAFETY Mark / COE lookup).
 * Product decision 2026-07-15: keep always-on REVIEW for now; long-term SKU allowlist
 * via advertisementContext.cpsrRegistered / coeRegistered (compliance-maintained list).
 */
const APPLIANCE_COMPLIANCE_CATEGORIES = new Set([
  'electronics',
  'sa.vacuum_floor',
  'sa.steam_mop',
  'sa.air_fryer',
  'sa.blender_processor',
  'sa.rice_cooker',
  'sa.soy_milk',
  'sa.coffee_espresso',
  'sa.kettle_cooker',
  'sa.other',
]);

export function fieldsContainCjk(fields: SearchableField[]): boolean {
  return fields.some((field) => CJK_PATTERN.test(field.value));
}

export function matchesRuleWhen(
  context: ReviewContext,
  when: RuleWhenCondition,
  fields: SearchableField[] = searchableFields(context),
): boolean {
  if (when.has_images !== undefined) {
    const hasImages = (context.normalizedContent.imageUrls?.length ?? 0) > 0;
    if (when.has_images !== hasImages) {
      return false;
    }
  }

  if (when.ai_rendered_image !== undefined) {
    const aiRendered = context.advertisementContext.aiRenderedImage === true;
    if (when.ai_rendered_image !== aiRendered) {
      return false;
    }
  }

  if (when.ocr_contains_cjk !== undefined) {
    const hasCjk = fieldsContainCjk(fields);
    if (when.ocr_contains_cjk !== hasCjk) {
      return false;
    }
  }

  if (when.certification_image_unreadable !== undefined) {
    const unreadable = context.advertisementContext.certificationImageUnreadable === true;
    if (when.certification_image_unreadable !== unreadable) {
      return false;
    }
  }

  if (when.ai_image_quality_issue !== undefined) {
    const qualityIssue = context.advertisementContext.aiImageQualityIssue === true;
    if (when.ai_image_quality_issue !== qualityIssue) {
      return false;
    }
  }

  if (when.category_requires_cpsr !== undefined) {
    const inScope = APPLIANCE_COMPLIANCE_CATEGORIES.has(
      context.dimensions.categoryId.toLowerCase(),
    );
    if (when.category_requires_cpsr !== inScope) {
      return false;
    }
  }

  if (when.category_requires_coe !== undefined) {
    const inScope = APPLIANCE_COMPLIANCE_CATEGORIES.has(
      context.dimensions.categoryId.toLowerCase(),
    );
    if (when.category_requires_coe !== inScope) {
      return false;
    }
  }

  if (when.audience_includes_children !== undefined) {
    const audience = (context.advertisementContext.targetAudience ?? '').toLowerCase();
    const includesChildren =
      /\b(kids?|children|child|儿童|小朋友)\b/i.test(audience) ||
      /\b(kids?|children|儿童|小朋友)\b/i.test(context.normalizedContent.text ?? '');
    if (when.audience_includes_children !== includesChildren) {
      return false;
    }
  }

  return true;
}

export function extractModelTokens(text: string): string[] {
  const matches = text.toUpperCase().match(MODEL_TOKEN_PATTERN) ?? [];
  return [...new Set(matches.map((token) => token.toUpperCase()))];
}

export function skuTokensMatch(expected: string, candidate: string): boolean {
  const normalizedExpected = expected.toUpperCase().replace(/\s+/g, '');
  const normalizedCandidate = candidate.toUpperCase().replace(/\s+/g, '');
  if (!normalizedExpected || !normalizedCandidate) {
    return false;
  }
  if (normalizedExpected === normalizedCandidate) {
    return true;
  }
  if (
    normalizedCandidate.startsWith(normalizedExpected) ||
    normalizedExpected.startsWith(normalizedCandidate)
  ) {
    return true;
  }
  return false;
}

/** Returns the first conflicting model token when expected SKU does not align with ad copy. */
export function findSkuMismatchToken(
  expectedSku: string,
  fields: SearchableField[],
): string | null {
  const tokens = fields.flatMap((field) => extractModelTokens(field.value));
  const candidates = tokens.filter((token) => token.length >= 3);
  if (candidates.length === 0) {
    return null;
  }

  const hasMatch = candidates.some((token) => skuTokensMatch(expectedSku, token));
  return hasMatch ? null : (candidates[0] ?? null);
}
