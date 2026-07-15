import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type GrayCopyCaseTemplate = {
  copy_id: number;
  category_id: string;
  gray_class: string;
  text: string;
  open_risk_must_fire: boolean;
  acceptable_risk_types: string[];
  notes?: string;
};

export type GrayCopyFixture = {
  schema_version: string;
  fixture_id: string;
  description: string;
  incidental_rule_refs_default: string[];
  countries: string[];
  cases: GrayCopyCaseTemplate[];
};

export type GrayCopyEvalCase = GrayCopyCaseTemplate & {
  case_id: string;
  country_id: string;
  incidental_rule_refs: string[];
};

const defaultPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../benchmark/gray-copy-fixture.json',
);

export function resolveGrayCopyFixturePath(override?: string): string {
  return override ?? process.env.AAIRP_GRAY_COPY_FIXTURE ?? defaultPath;
}

export function loadGrayCopyFixture(path = resolveGrayCopyFixturePath()): GrayCopyFixture {
  return JSON.parse(readFileSync(path, 'utf8')) as GrayCopyFixture;
}

export function expandGrayCopyCases(
  fixture: GrayCopyFixture,
  options: { countries?: string[]; copyIds?: number[] } = {},
): GrayCopyEvalCase[] {
  const countries = options.countries?.length
    ? options.countries
    : fixture.countries;
  const copyFilter = options.copyIds?.length
    ? new Set(options.copyIds)
    : null;

  const out: GrayCopyEvalCase[] = [];
  for (const country of countries) {
    for (const base of fixture.cases) {
      if (copyFilter && !copyFilter.has(base.copy_id)) continue;
      out.push({
        ...base,
        case_id: `gray-${country}-${String(base.copy_id).padStart(2, '0')}`,
        country_id: country,
        incidental_rule_refs: [...fixture.incidental_rule_refs_default],
      });
    }
  }
  return out;
}
