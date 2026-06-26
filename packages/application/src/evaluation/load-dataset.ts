import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BenchmarkGroundTruth } from './benchmark-types.js';
import { defaultDatasetRoot, resolveDatasetCasePath } from './dataset-paths.js';

export type DatasetIntent = 'PASS' | 'WARN' | 'REJECT' | 'EDGE';
export type DatasetVerification = 'auto' | 'manual';

export type DatasetCaseIndexEntry = {
  case_id: string;
  path: string;
  intent: DatasetIntent;
  verification: DatasetVerification;
};

export type DatasetIndex = {
  schema_version: string;
  dataset_id: string;
  description?: string;
  countries: string[];
  categories: string[];
  cases: DatasetCaseIndexEntry[];
};

export type DatasetCase = {
  case_id: string;
  country_id: string;
  category_id: string;
  platform_id: string;
  intent: DatasetIntent;
  verification: DatasetVerification;
  notes?: string;
  tags?: string[];
  upload: unknown;
  ground_truth?: BenchmarkGroundTruth;
};

function assertDatasetCase(raw: unknown, caseId: string): DatasetCase {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`dataset case ${caseId} must be a JSON object`);
  }

  const datasetCase = raw as DatasetCase;
  if (datasetCase.case_id !== caseId) {
    throw new Error(`dataset case_id mismatch: index=${caseId} file=${datasetCase.case_id}`);
  }
  if (!datasetCase.upload) {
    throw new Error(`dataset case ${caseId} requires upload payload`);
  }

  return datasetCase;
}

export function loadDatasetIndex(datasetRoot = defaultDatasetRoot()): DatasetIndex {
  const content = readFileSync(join(datasetRoot, 'index.json'), 'utf8');
  const index = JSON.parse(content) as DatasetIndex;

  if (!index.schema_version || !Array.isArray(index.cases) || index.cases.length === 0) {
    throw new Error('invalid dataset index.json');
  }

  return index;
}

export function loadDatasetCase(
  caseId: string,
  datasetRoot = defaultDatasetRoot(),
): DatasetCase {
  const index = loadDatasetIndex(datasetRoot);
  const entry = index.cases.find((item) => item.case_id === caseId);
  if (!entry) {
    throw new Error(`dataset case not found: ${caseId}`);
  }

  const casePath = resolveDatasetCasePath(datasetRoot, entry.path);
  const content = readFileSync(casePath, 'utf8');
  return assertDatasetCase(JSON.parse(content), caseId);
}

export function loadAllDatasetCases(datasetRoot = defaultDatasetRoot()): DatasetCase[] {
  const index = loadDatasetIndex(datasetRoot);
  return index.cases.map((entry) => loadDatasetCase(entry.case_id, datasetRoot));
}

export function loadAutoVerifiedDatasetCases(datasetRoot = defaultDatasetRoot()): DatasetCase[] {
  return loadAllDatasetCases(datasetRoot).filter(
    (datasetCase) => datasetCase.verification === 'auto',
  );
}

export function getDatasetCaseUpload(datasetCase: DatasetCase): unknown {
  return datasetCase.upload;
}
