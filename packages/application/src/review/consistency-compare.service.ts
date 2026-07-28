import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AssetFieldExtract,
  ConsistencyDiscoveryResult,
  ConsistencyFinding,
} from '@aairp/shared-kernel';
import { createConsistencyFinding } from '@aairp/shared-kernel';
import type { ILlmGateway } from './stub-llm.gateway.types.js';
import { parseConsistencyResponseContent } from './consistency-response.parser.js';

export type ConsistencyCompareConfig = {
  createFindingId?: () => string;
  now?: () => Date;
  promptPackVersion?: string;
  promptPath?: string;
  promptTemplate?: string;
  stubResponsePath?: string;
  llmGateway?: ILlmGateway | null;
  readTextFile?: (path: string) => string;
  /**
   * When true (or when AAIRP_CONSISTENCY_LLM=stub|live), run compare-only LLM assist
   * after deterministic diff and merge non-duplicate findings.
   */
  enableLlmAssist?: boolean;
};

type FieldKey = keyof Pick<
  AssetFieldExtract,
  'capacity' | 'voltage' | 'modelTokens' | 'material' | 'languagesOnPanel' | 'quantitativeClaims'
>;

const COMPARE_FIELDS: FieldKey[] = [
  'capacity',
  'voltage',
  'modelTokens',
  'material',
  'languagesOnPanel',
  'quantitativeClaims',
];

const defaultPromptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/consistency.prompt.txt',
);
const defaultStubPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../demo/consistency.stub.json',
);

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

function unitFamily(value: string): string {
  const match = value.toLowerCase().match(/(kpa|kw|w|ml|l|v|rpm|pa|db)$/);
  return match?.[1] ?? 'token';
}

export function resolveConsistencyLlmMode(): 'live' | 'stub' | 'off' {
  const mode = process.env.AAIRP_CONSISTENCY_LLM?.trim().toLowerCase();
  if (mode === 'live' || mode === 'stub') {
    return mode;
  }
  const visionMode = process.env.AAIRP_VISION_MODE?.trim().toLowerCase();
  if (visionMode === 'stub') {
    return 'stub';
  }
  if (visionMode === 'live') {
    return 'live';
  }
  return 'off';
}

function renderConsistencyPrompt(
  template: string,
  input: {
    countryId: string;
    platformId: string;
    categoryId: string;
    fieldExtracts: AssetFieldExtract[];
    deterministicConflicts: string[];
  },
): string {
  return template
    .replaceAll('{country_id}', input.countryId)
    .replaceAll('{platform_id}', input.platformId)
    .replaceAll('{category_id}', input.categoryId)
    .replaceAll(
      '{deterministic_conflicts}',
      input.deterministicConflicts.length > 0
        ? input.deterministicConflicts.join('; ')
        : '(none)',
    )
    .replaceAll('{field_extracts_json}', JSON.stringify(input.fieldExtracts, null, 2));
}

/**
 * Deterministic cross-slice field compare (ADR-005 §6.2 pass 2),
 * with optional compare-only LLM assist.
 */
export class ConsistencyCompareService {
  constructor(private readonly config: ConsistencyCompareConfig = {}) {}

  compare(input: {
    reviewId: string;
    fieldExtracts: AssetFieldExtract[];
    countryId?: string;
    platformId?: string;
    categoryId?: string;
  }): ConsistencyDiscoveryResult {
    const evaluatedAt = (this.config.now ?? (() => new Date()))().toISOString();
    const extracts = input.fieldExtracts;

    if (extracts.length < 2) {
      return {
        reviewId: input.reviewId,
        fieldExtracts: extracts,
        findings: [],
        skipped: true,
        skipReason: extracts.length === 0 ? 'NO_EXTRACTS' : 'SINGLE_SLICE',
        evaluatedAt,
      };
    }

    const findings = this.compareDeterministic(extracts);

    return {
      reviewId: input.reviewId,
      fieldExtracts: extracts,
      findings,
      skipped: false,
      evaluatedAt,
    };
  }

  async compareWithOptionalLlmAssist(input: {
    reviewId: string;
    fieldExtracts: AssetFieldExtract[];
    countryId?: string;
    platformId?: string;
    categoryId?: string;
  }): Promise<ConsistencyDiscoveryResult> {
    const base = this.compare(input);
    if (base.skipped) {
      return base;
    }

    const mode = resolveConsistencyLlmMode();
    const enable =
      this.config.enableLlmAssist === true ||
      (this.config.enableLlmAssist !== false && mode !== 'off');
    if (!enable || !this.config.llmGateway) {
      if (!enable || mode === 'off') {
        return base;
      }
    }

    try {
      const readTextFile =
        this.config.readTextFile ?? ((path: string) => readFileSync(path, 'utf8'));
      const promptTemplate =
        this.config.promptTemplate ??
        readTextFile(this.config.promptPath ?? defaultPromptPath);
      const prompt = renderConsistencyPrompt(promptTemplate, {
        countryId: input.countryId ?? 'SG',
        platformId: input.platformId ?? 'SHOPEE',
        categoryId: input.categoryId ?? 'sa.rice_cooker',
        fieldExtracts: input.fieldExtracts,
        deterministicConflicts: base.findings.map((f) => f.summary),
      });

      let content: string;
      if (this.config.llmGateway) {
        const response = await this.config.llmGateway.complete(prompt);
        content = response.content;
      } else if (mode === 'stub') {
        content = readTextFile(this.config.stubResponsePath ?? defaultStubPath);
      } else {
        return base;
      }

      const parsed = parseConsistencyResponseContent(content);
      const seen = new Set(
        base.findings.map(
          (f) => `${f.evaluationDetail.field}:${[...f.evaluationDetail.values].sort().join('|')}`,
        ),
      );
      const merged = [...base.findings];
      for (const payload of parsed.findings) {
        if (!payload.field || !payload.conflict || !Array.isArray(payload.slices_involved)) {
          continue;
        }
        const values = payload.values ?? [];
        const key = `${payload.field}:${[...values].map(normalizeValue).sort().join('|')}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        merged.push(
          createConsistencyFinding({
            findingId: `cf_${(this.config.createFindingId ?? randomUUID)()}`,
            field: payload.field,
            conflict: payload.conflict,
            slicesInvolved: payload.slices_involved,
            values,
            severity: payload.severity ?? 'MEDIUM',
            confidence: payload.confidence ?? 0.8,
            promptPackVersion:
              parsed.prompt_pack_version ?? this.config.promptPackVersion ?? 'demo-consistency-1.0.0',
          }),
        );
      }

      return {
        ...base,
        findings: merged,
      };
    } catch {
      return base;
    }
  }

  private compareDeterministic(extracts: AssetFieldExtract[]): ConsistencyFinding[] {
    const findings: ConsistencyFinding[] = [];

    for (const field of COMPARE_FIELDS) {
      const observations: Array<{ sliceId: string; value: string }> = [];
      for (const extract of extracts) {
        for (const value of extract[field] ?? []) {
          observations.push({ sliceId: extract.sliceId, value });
        }
      }
      if (observations.length < 2) {
        continue;
      }

      if (field === 'languagesOnPanel') {
        const bySlice = new Map<string, Set<string>>();
        for (const obs of observations) {
          const set = bySlice.get(obs.sliceId) ?? new Set<string>();
          set.add(normalizeValue(obs.value));
          bySlice.set(obs.sliceId, set);
        }
        const sliceIds = [...bySlice.keys()];
        if (sliceIds.length < 2) {
          continue;
        }
        const first = bySlice.get(sliceIds[0]!)!;
        const conflictSlice = sliceIds.find((id) => {
          const langs = bySlice.get(id)!;
          if (langs.size !== first.size) {
            return true;
          }
          for (const lang of langs) {
            if (!first.has(lang)) {
              return true;
            }
          }
          return false;
        });
        if (!conflictSlice) {
          continue;
        }
        findings.push(
          createConsistencyFinding({
            findingId: `cf_${(this.config.createFindingId ?? randomUUID)()}`,
            field,
            conflict: `Panel/on-image language set differs across slices (${[...first].join(',')} vs ${[...(bySlice.get(conflictSlice) ?? [])].join(',')}).`,
            slicesInvolved: sliceIds,
            values: sliceIds.map((id) => [...(bySlice.get(id) ?? [])].sort().join('+')),
            promptPackVersion: this.config.promptPackVersion,
          }),
        );
        continue;
      }

      const byFamily = new Map<string, Map<string, Set<string>>>();
      for (const obs of observations) {
        const family = field === 'modelTokens' ? 'model' : unitFamily(obs.value);
        const bySlice = byFamily.get(family) ?? new Map<string, Set<string>>();
        const set = bySlice.get(obs.sliceId) ?? new Set<string>();
        set.add(normalizeValue(obs.value));
        bySlice.set(obs.sliceId, set);
        byFamily.set(family, bySlice);
      }

      for (const [family, bySlice] of byFamily) {
        const sliceIds = [...bySlice.keys()];
        if (sliceIds.length < 2) {
          continue;
        }
        const serialize = (id: string) => [...(bySlice.get(id) ?? [])].sort().join('|');
        const baseline = serialize(sliceIds[0]!);
        const conflictId = sliceIds.find((id) => serialize(id) !== baseline);
        if (!conflictId) {
          continue;
        }
        const values = [...new Set(sliceIds.map(serialize))];
        findings.push(
          createConsistencyFinding({
            findingId: `cf_${(this.config.createFindingId ?? randomUUID)()}`,
            field: field === 'quantitativeClaims' ? `quantitativeClaims:${family}` : field,
            conflict: `Inconsistent ${field} (${family}) across long-image slices: ${values.join(' vs ')}.`,
            slicesInvolved: sliceIds,
            values,
            promptPackVersion: this.config.promptPackVersion,
          }),
        );
      }
    }

    return findings;
  }
}
