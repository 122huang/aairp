import type { CaseRecord } from '@aairp/shared-kernel';
import type { ICaseStore } from '@aairp/shared-kernel';

export class CaseExportService {
  constructor(private readonly caseStore: ICaseStore) {}

  exportAll(): Promise<CaseRecord[]> {
    return this.caseStore.exportAll();
  }

  async exportJsonBundle(): Promise<string> {
    const cases = await this.exportAll();
    return JSON.stringify(
      {
        schema_version: '1.0.0',
        exported_at: new Date().toISOString(),
        count: cases.length,
        cases,
      },
      null,
      2,
    );
  }
}
