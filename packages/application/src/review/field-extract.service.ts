import type { AssetFieldExtract } from '@aairp/shared-kernel';

const CAPACITY_PATTERN = /(\d+(?:\.\d+)?)\s*(kpa|l|w|ml|kw)\b/gi;
const VOLTAGE_PATTERN = /(\d{2,3})\s*v\b/gi;
const MODEL_PATTERN = /\b[A-Z]{1,4}[-_]?[A-Z]?\d{2,}[A-Z0-9-]*\b/g;
const MATERIAL_PATTERN =
  /\b(stainless\s*steel|copper|ceramic|aluminum|aluminium|titanium|plastic|pp|abs)\b/gi;
const CERT_PATTERN = /\b(CCC|CE|UL|GS|PSE|CB|ETL|RoHS|FDA)\b/g;

function uniquePreserve(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(value);
  }
  return out;
}

function detectLanguages(text: string): string[] {
  const languages: string[] = [];
  if (/[\u4e00-\u9fff]/.test(text)) {
    languages.push('zh');
  }
  if (/[\u0e00-\u0e7f]/.test(text)) {
    languages.push('th');
  }
  if (/[A-Za-z]{3,}/.test(text)) {
    languages.push('en');
  }
  return languages;
}

function matchAll(text: string, pattern: RegExp): string[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const re = new RegExp(pattern.source, flags);
  const values: string[] = [];
  for (const match of text.matchAll(re)) {
    values.push(match[0]!.replace(/\s+/g, ' ').trim());
  }
  return uniquePreserve(values);
}

export function extractAssetFieldsFromText(input: {
  sliceId: string;
  sourceImageIndex: number;
  sliceIndex: number;
  texts: string[];
}): AssetFieldExtract {
  const text = input.texts.join('\n');
  const capacity = matchAll(text, CAPACITY_PATTERN);
  const voltage = matchAll(text, VOLTAGE_PATTERN);
  const modelTokens = matchAll(text, MODEL_PATTERN);
  const material = matchAll(text, MATERIAL_PATTERN);
  const certificationMarks = matchAll(text, CERT_PATTERN);
  const languagesOnPanel = detectLanguages(text);
  const quantitativeClaims = uniquePreserve([
    ...capacity,
    ...voltage,
    ...matchAll(text, /(\d+(?:\.\d+)?)\s*(kpa|rpm|pa|db)\b/gi),
  ]);

  return {
    sliceId: input.sliceId,
    sourceImageIndex: input.sourceImageIndex,
    sliceIndex: input.sliceIndex,
    ...(modelTokens.length > 0 ? { modelTokens } : {}),
    ...(capacity.length > 0 ? { capacity } : {}),
    ...(material.length > 0 ? { material } : {}),
    ...(voltage.length > 0 ? { voltage } : {}),
    ...(languagesOnPanel.length > 0 ? { languagesOnPanel } : {}),
    ...(certificationMarks.length > 0 ? { certificationMarks } : {}),
    ...(quantitativeClaims.length > 0 ? { quantitativeClaims } : {}),
  };
}

export class FieldExtractService {
  extractFromSliceTexts(
    slices: Array<{
      sliceId: string;
      sourceImageIndex: number;
      sliceIndex: number;
      texts: string[];
    }>,
  ): AssetFieldExtract[] {
    return slices
      .map((slice) => extractAssetFieldsFromText(slice))
      .filter(
        (extract) =>
          (extract.capacity?.length ?? 0) > 0 ||
          (extract.voltage?.length ?? 0) > 0 ||
          (extract.modelTokens?.length ?? 0) > 0 ||
          (extract.material?.length ?? 0) > 0 ||
          (extract.languagesOnPanel?.length ?? 0) > 0 ||
          (extract.certificationMarks?.length ?? 0) > 0 ||
          (extract.quantitativeClaims?.length ?? 0) > 0,
      );
  }
}
