import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertKnowledgeIdMatches,
  type CorpusType,
  type KnowledgeCorpusEnvelope,
  type KnowledgeRiskLevel,
} from './knowledge-corpus.js';

export type RegulationCategoryName =
  | 'Health Claims'
  | 'Medical Claims'
  | 'Comparative Advertising'
  | 'Environmental Claims'
  | 'Certification'
  | 'Safety Claims'
  | 'Performance Claims'
  | 'Pricing'
  | 'Consumer Protection'
  | 'AI-generated Content'
  | 'Image Usage'
  | 'Mandatory Disclaimers';

export type RegulationCountryCode = 'SG' | 'MY' | 'TH' | 'ID' | 'JP' | 'KR' | 'AU' | 'VN' | 'PH';

export type RegulationCorpusEntry = KnowledgeCorpusEnvelope & {
  corpus_type: 'regulation';
  regulation_id: string;
  country: RegulationCountryCode;
  authority: string;
  regulation_name: string;
  citation: string;
  effective_date: string;
  category: RegulationCategoryName;
  mandatory: boolean;
  risk_level: KnowledgeRiskLevel;
  summary: string;
  review_guidance: string;
  related_rule_ids: string[];
  pending_rule_ids: string[];
  related_evidence_ids: string[];
  source_url?: string;
  jurisdiction_scope?: string[];
};

export type RegulationCategoryDef = {
  category_id: string;
  name: RegulationCategoryName;
  description: string;
};

export type RegulationCategoriesDocument = {
  schema_version: string;
  description: string;
  categories: RegulationCategoryDef[];
};

export type RegulationCountryDef = {
  country_code: RegulationCountryCode;
  name: string;
  authorities: string[];
};

export type RegulationCountriesDocument = {
  schema_version: string;
  description: string;
  countries: RegulationCountryDef[];
};

export type RegulationCorpusLoadResult = {
  root: string;
  categories: RegulationCategoriesDocument;
  countries: RegulationCountriesDocument;
  entries: RegulationCorpusEntry[];
  by_country: Record<string, RegulationCorpusEntry[]>;
};

export const REGULATION_CORPUS_COUNTRY_CODES: RegulationCountryCode[] = [
  'SG',
  'MY',
  'TH',
  'ID',
  'JP',
  'KR',
  'AU',
  'VN',
  'PH',
];

const defaultCorpusRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/knowledge/regulation-corpus',
);

export function resolveRegulationCorpusRoot(customRoot?: string): string {
  if (customRoot) {
    return customRoot;
  }
  if (process.env.AAIRP_REGULATION_CORPUS_PATH) {
    return process.env.AAIRP_REGULATION_CORPUS_PATH;
  }
  return defaultCorpusRoot;
}

export function loadRegulationCategories(customRoot?: string): RegulationCategoriesDocument {
  const root = resolveRegulationCorpusRoot(customRoot);
  return JSON.parse(
    readFileSync(join(root, 'regulation-categories.json'), 'utf8'),
  ) as RegulationCategoriesDocument;
}

export function loadRegulationCountries(customRoot?: string): RegulationCountriesDocument {
  const root = resolveRegulationCorpusRoot(customRoot);
  return JSON.parse(readFileSync(join(root, 'countries.json'), 'utf8')) as RegulationCountriesDocument;
}

export function normalizeRegulationEntry(raw: RegulationCorpusEntry): RegulationCorpusEntry {
  assertKnowledgeIdMatches(raw.knowledge_id, 'regulation', raw.regulation_id);
  if (raw.corpus_type !== 'regulation') {
    throw new Error(`expected corpus_type regulation, got ${raw.corpus_type}`);
  }
  if (!REGULATION_CORPUS_COUNTRY_CODES.includes(raw.country)) {
    throw new Error(`unsupported country code: ${raw.country}`);
  }
  for (const evidenceId of raw.related_evidence_ids) {
    if (!evidenceId.startsWith('evidence:')) {
      throw new Error(`related_evidence_ids must use evidence: prefix: ${evidenceId}`);
    }
  }
  return {
    ...raw,
    pending_rule_ids: raw.pending_rule_ids ?? [],
  };
}

export function loadRegulationCorpusEntry(filePath: string): RegulationCorpusEntry {
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as RegulationCorpusEntry;
  return normalizeRegulationEntry(raw);
}

function listRegulationJsonFiles(countryDir: string): string[] {
  if (!existsSync(countryDir)) {
    return [];
  }
  return readdirSync(countryDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => join(countryDir, entry.name));
}

export function loadRegulationCorpusEntries(customRoot?: string): RegulationCorpusEntry[] {
  const root = resolveRegulationCorpusRoot(customRoot);
  const regulationsDir = join(root, 'regulations');
  const entries: RegulationCorpusEntry[] = [];

  for (const countryCode of REGULATION_CORPUS_COUNTRY_CODES) {
    const countryDir = join(regulationsDir, countryCode);
    for (const filePath of listRegulationJsonFiles(countryDir)) {
      entries.push(loadRegulationCorpusEntry(filePath));
    }
  }

  return entries.sort((a, b) => a.regulation_id.localeCompare(b.regulation_id));
}

export function loadRegulationCorpus(customRoot?: string): RegulationCorpusLoadResult {
  const root = resolveRegulationCorpusRoot(customRoot);
  const categories = loadRegulationCategories(root);
  const countries = loadRegulationCountries(root);
  const entries = loadRegulationCorpusEntries(root);

  const by_country: Record<string, RegulationCorpusEntry[]> = {};
  for (const code of REGULATION_CORPUS_COUNTRY_CODES) {
    by_country[code] = entries.filter((entry) => entry.country === code);
  }

  return { root, categories, countries, entries, by_country };
}

export function listRegulationCategoryNames(
  doc: RegulationCategoriesDocument,
): RegulationCategoryName[] {
  return doc.categories.map((category) => category.name);
}

export function listRegulationCountryCodes(doc: RegulationCountriesDocument): RegulationCountryCode[] {
  return doc.countries.map((country) => country.country_code);
}

export function isRegulationCorpusType(corpusType: CorpusType): corpusType is 'regulation' {
  return corpusType === 'regulation';
}
