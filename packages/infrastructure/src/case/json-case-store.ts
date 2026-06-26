import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  CaseManifestEntry,
  CaseRecord,
  CaseSaveResult,
  CaseSearchFilters,
  ICaseStore,
} from '@aairp/shared-kernel';
import { CASE_SCHEMA_VERSION } from '@aairp/shared-kernel';

export type JsonCaseStoreConfig = {
  rootPath: string;
};

type ManifestFile = {
  schema_version: string;
  updated_at: string;
  entries: CaseManifestEntry[];
};

type DimensionIndexFile = {
  case_ids: string[];
  updated_at: string;
};

export class JsonCaseStore implements ICaseStore {
  constructor(private readonly config: JsonCaseStoreConfig) {}

  get rootPath(): string {
    return this.config.rootPath;
  }

  async save(record: CaseRecord): Promise<CaseSaveResult> {
    const relativePath = this.buildCaseRelativePath(record);
    const absolutePath = join(this.config.rootPath, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });

    const existing = await this.findByReviewId(record.review_id);
    if (existing) {
      return {
        case_id: existing.case_id,
        path: relativePath,
        created: false,
      };
    }

    await writeFile(absolutePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    await this.appendManifest(record, relativePath);
    await this.updateDimensionIndex(record);

    return {
      case_id: record.case_id,
      path: relativePath,
      created: true,
    };
  }

  async findByCaseId(caseId: string): Promise<CaseRecord | null> {
    const manifest = await this.readManifest();
    const entry = manifest.entries.find((item) => item.case_id === caseId);
    if (!entry) {
      return null;
    }
    return this.readCaseFile(entry.path);
  }

  async findByReviewId(reviewId: string): Promise<CaseRecord | null> {
    const manifest = await this.readManifest();
    const entry = manifest.entries.find((item) => item.review_id === reviewId);
    if (!entry) {
      return null;
    }
    return this.readCaseFile(entry.path);
  }

  async search(filters: CaseSearchFilters): Promise<CaseManifestEntry[]> {
    const manifest = await this.readManifest();
    let results = [...manifest.entries];

    if (filters.country_id) {
      results = results.filter((e) => e.country_id === filters.country_id);
    }
    if (filters.category_id) {
      results = results.filter((e) => e.category_id === filters.category_id);
    }
    if (filters.platform_id) {
      results = results.filter((e) => e.platform_id === filters.platform_id);
    }
    if (filters.language) {
      results = results.filter((e) => e.language === filters.language);
    }
    if (filters.ai_decision) {
      results = results.filter((e) => e.ai_decision === filters.ai_decision);
    }
    if (filters.final_decision) {
      results = results.filter((e) => e.final_decision === filters.final_decision);
    }
    if (filters.lifecycle_status) {
      results = results.filter((e) => e.lifecycle_status === filters.lifecycle_status);
    }
    if (filters.review_id) {
      results = results.filter((e) => e.review_id === filters.review_id);
    }
    if (filters.content_hash) {
      results = results.filter((e) => e.content_hash === filters.content_hash);
    }

    results.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  async listManifest(): Promise<CaseManifestEntry[]> {
    const manifest = await this.readManifest();
    return manifest.entries;
  }

  async exportAll(): Promise<CaseRecord[]> {
    const manifest = await this.readManifest();
    const cases: CaseRecord[] = [];
    for (const entry of manifest.entries) {
      const record = await this.readCaseFile(entry.path);
      if (record) {
        cases.push(record);
      }
    }
    return cases;
  }

  private buildCaseRelativePath(record: CaseRecord): string {
    const date = new Date(record.created_at);
    const yyyy = String(date.getUTCFullYear());
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    return join('cases', yyyy, mm, `${record.case_id}.json`);
  }

  private manifestPath(): string {
    return join(this.config.rootPath, 'index', 'manifest.json');
  }

  private dimensionIndexPath(record: CaseRecord): string {
    return join(
      this.config.rootPath,
      'index',
      'by-dimension',
      record.dimensions.country_id,
      record.dimensions.category_id,
      record.dimensions.platform_id,
      'index.json',
    );
  }

  private async readManifest(): Promise<ManifestFile> {
    const path = this.manifestPath();
    try {
      const raw = await readFile(path, 'utf8');
      return JSON.parse(raw) as ManifestFile;
    } catch {
      return {
        schema_version: CASE_SCHEMA_VERSION,
        updated_at: new Date().toISOString(),
        entries: [],
      };
    }
  }

  private async writeManifestAtomic(manifest: ManifestFile): Promise<void> {
    const path = this.manifestPath();
    await mkdir(dirname(path), { recursive: true });
    const tempPath = `${path}.tmp`;
    manifest.updated_at = new Date().toISOString();
    await writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await rename(tempPath, path);
  }

  private async appendManifest(record: CaseRecord, relativePath: string): Promise<void> {
    const manifest = await this.readManifest();
    const entry: CaseManifestEntry = {
      case_id: record.case_id,
      case_version: record.case_version,
      path: relativePath.replace(/\\/g, '/'),
      review_id: record.review_id,
      country_id: record.dimensions.country_id,
      category_id: record.dimensions.category_id,
      platform_id: record.dimensions.platform_id,
      language: record.advertisement.content.language,
      ai_decision: record.decision.ai_decision,
      final_decision: record.decision.final_decision,
      lifecycle_status: record.lifecycle_status,
      content_hash: record.advertisement.content_hash,
      created_at: record.created_at,
      updated_at: record.updated_at,
    };
    manifest.entries.push(entry);
    await this.writeManifestAtomic(manifest);
  }

  private async updateDimensionIndex(record: CaseRecord): Promise<void> {
    const path = this.dimensionIndexPath(record);
    await mkdir(dirname(path), { recursive: true });

    let index: DimensionIndexFile = { case_ids: [], updated_at: new Date().toISOString() };
    try {
      index = JSON.parse(await readFile(path, 'utf8')) as DimensionIndexFile;
    } catch {
      // new index
    }

    if (!index.case_ids.includes(record.case_id)) {
      index.case_ids.push(record.case_id);
    }
    index.updated_at = new Date().toISOString();

    const tempPath = `${path}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
    await rename(tempPath, path);
  }

  private async readCaseFile(relativePath: string): Promise<CaseRecord | null> {
    try {
      const raw = await readFile(join(this.config.rootPath, relativePath), 'utf8');
      return JSON.parse(raw) as CaseRecord;
    } catch {
      return null;
    }
  }
}
