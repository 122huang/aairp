import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function defaultDatasetRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../demo/dataset');
}

export function resolveDatasetCasePath(datasetRoot: string, relativePath: string): string {
  return join(datasetRoot, relativePath);
}
