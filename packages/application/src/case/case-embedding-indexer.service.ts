import type {
  CaseEmbeddingRecord,
  CaseRecord,
  ICaseEmbeddingRepository,
  ICaseKosRepository,
  IEmbeddingProvider,
} from '@aairp/shared-kernel';
import { buildCaseEmbedText } from '@aairp/shared-kernel';

export type CaseEmbeddingIndexItem = {
  case_id: string;
  case_version: number;
  action: 'indexed' | 'skipped';
};

export type CaseEmbeddingIndexResult = {
  indexed: number;
  skipped: number;
  items: CaseEmbeddingIndexItem[];
};

export type CaseEmbeddingIndexerConfig = {
  now?: () => Date;
};

export class CaseEmbeddingIndexerService {
  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly config: CaseEmbeddingIndexerConfig = {},
  ) {}

  async indexRecord(
    record: CaseRecord,
    embeddingRepository: ICaseEmbeddingRepository,
  ): Promise<'indexed' | 'skipped'> {
    const existing = await embeddingRepository.findByCaseId(
      record.case_id,
      this.embeddingProvider.modelId,
    );
    if (existing && existing.case_version >= record.case_version) {
      return 'skipped';
    }

    const embedText = buildCaseEmbedText(record);
    const embedding = this.embeddingProvider.embed(embedText);
    const createdAt = (this.config.now ?? (() => new Date()))().toISOString();

    const payload: CaseEmbeddingRecord = {
      case_id: record.case_id,
      case_version: record.case_version,
      embedding_model: this.embeddingProvider.modelId,
      embedding,
      embed_text: embedText,
      dimensions: this.embeddingProvider.dimensions,
      created_at: createdAt,
    };

    await embeddingRepository.upsert(payload);
    return 'indexed';
  }

  async indexFromKosRepository(
    caseKosRepository: ICaseKosRepository,
    embeddingRepository: ICaseEmbeddingRepository,
  ): Promise<CaseEmbeddingIndexResult> {
    const records = await caseKosRepository.exportAllLatest();
    const items: CaseEmbeddingIndexItem[] = [];

    for (const record of records) {
      const action = await this.indexRecord(record, embeddingRepository);
      items.push({
        case_id: record.case_id,
        case_version: record.case_version,
        action,
      });
    }

    return {
      indexed: items.filter((item) => item.action === 'indexed').length,
      skipped: items.filter((item) => item.action === 'skipped').length,
      items,
    };
  }
}
