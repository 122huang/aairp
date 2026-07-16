import { describe, expect, it } from 'vitest';
import {
  loadAutoVerifiedDatasetCases,
  loadDatasetCase,
  loadDatasetIndex,
} from './load-dataset.js';
import { runDatasetEval } from './dataset-evaluator.service.js';

describe('demo dataset index', () => {
  it('loads index with 53 cases across 10 countries and 4 categories', () => {
    const index = loadDatasetIndex();

    expect(index.schema_version).toBe('1.0.0');
    expect(index.dataset_id).toBe('aairp-demo-dataset');
    expect(index.countries).toHaveLength(10);
    expect(index.countries).toContain('VN');
    expect(index.countries).toContain('CN');
    expect(index.categories).toHaveLength(4);
    expect(index.cases).toHaveLength(53);
  });

  it('loads each indexed case file with matching case_id and upload payload', () => {
    const index = loadDatasetIndex();

    for (const entry of index.cases) {
      const datasetCase = loadDatasetCase(entry.case_id);
      expect(datasetCase.case_id).toBe(entry.case_id);
      expect(datasetCase.upload).toBeTruthy();
      expect(datasetCase.ground_truth).toBeTruthy();
      expect(datasetCase.intent).toBe(entry.intent);
    }
  });

  it('includes canonical sg-health-reject-cure migrated from sample-ad', () => {
    const datasetCase = loadDatasetCase('sg-health-reject-cure');
    const upload = datasetCase.upload as { content?: { text?: string } };

    expect(datasetCase.country_id).toBe('SG');
    expect(datasetCase.category_id).toBe('health.supplement');
    expect(upload.content?.text).toContain('cure');
    expect(datasetCase.ground_truth?.expected_decision).toBe('REJECT');
  });

  it('has 53 auto-verified cases', () => {
    const autoCases = loadAutoVerifiedDatasetCases();
    expect(autoCases.length).toBe(53);
    expect(autoCases.map((item) => item.case_id)).toContain('sg-health-reject-cure');
    expect(autoCases.map((item) => item.case_id)).toContain('id-sa-warn-category-boundary');
  });
});

describe('dataset evaluation', () => {
  it('passes all 53 dataset cases against current engine ground truth', async () => {
    const result = await runDatasetEval({ writeReports: false });

    expect(result.metrics.total_cases).toBe(53);
    expect(result.metrics.decision_accuracy).toBe(1);
    expect(result.failed_case_ids).toEqual([]);
  });

  it('passes auto-verified subset via upload pipeline', async () => {
    const result = await runDatasetEval({ autoOnly: true, writeReports: false });

    expect(result.metrics.total_cases).toBe(53);
    expect(result.metrics.passed_cases).toBe(53);
  });
});
