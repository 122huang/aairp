import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CaseRecord, ICaseKosRepository } from '@aairp/shared-kernel';
import { CASE_SCHEMA_VERSION } from '@aairp/shared-kernel';

export type CaseImportItemResult = {
  case_id: string;
  action: 'imported' | 'skipped';
};

export type CaseImportResult = {
  imported: number;
  skipped: number;
  items: CaseImportItemResult[];
};

export type CaseImportServiceDeps = {
  caseKosRepository: ICaseKosRepository;
};

export class CaseImportService {
  constructor(private readonly deps: CaseImportServiceDeps) {}

  async importFromDirectory(rootPath: string): Promise<CaseImportResult> {
    const files = await this.collectCaseFiles(rootPath);
    const items: CaseImportItemResult[] = [];

    for (const filePath of files) {
      const raw = await readFile(filePath, 'utf8');
      const record = JSON.parse(raw) as CaseRecord;
      if (record.schema_version !== CASE_SCHEMA_VERSION) {
        throw new Error(`unsupported case schema in ${filePath}: ${record.schema_version}`);
      }

      const result = await this.deps.caseKosRepository.save(record);
      items.push({
        case_id: record.case_id,
        action: result.created ? 'imported' : 'skipped',
      });
    }

    return {
      imported: items.filter((item) => item.action === 'imported').length,
      skipped: items.filter((item) => item.action === 'skipped').length,
      items,
    };
  }

  private async collectCaseFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    await this.walk(rootPath, files);
    return files.sort();
  }

  private async walk(directory: string, files: string[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await this.walk(fullPath, files);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.case.json')) {
        files.push(fullPath);
      }
    }
  }
}
