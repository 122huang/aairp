import { EVIDENCE_SOURCE_TYPES, type EvidenceSourceType } from '@aairp/shared-kernel';

export const EVIDENCE_POOL_MAX_FILES = 5;
export const EVIDENCE_POOL_MAX_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_POOL_EXTENSIONS = ['.pdf', '.txt', '.md'] as const;

export type EvidencePoolFileInput = {
  filename: string;
  mime_type: string;
  content_base64: string;
  evidence_source_type: EvidenceSourceType;
};

export type EvidencePoolIssue = {
  field: string;
  message: string;
};

export class EvidencePoolValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: EvidencePoolIssue[],
  ) {
    super(message);
    this.name = 'EvidencePoolValidationError';
  }
}

export function evidenceTitleFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, '').trim();
  if (!base) return '';
  const withoutExt = base.replace(/\.(pdf|txt|md)$/i, '').trim();
  return withoutExt || base;
}

function extensionOf(filename: string): string {
  const match = filename.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? '';
}

function isEvidenceSourceType(value: string): value is EvidenceSourceType {
  return (EVIDENCE_SOURCE_TYPES as readonly string[]).includes(value);
}

function decodedByteLength(base64: string): number {
  const trimmed = base64.replace(/\s/g, '');
  const padding = trimmed.endsWith('==') ? 2 : trimmed.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((trimmed.length * 3) / 4) - padding);
}

/**
 * Read optional top-level `evidence_files` from a demo review body.
 * Missing / empty → []. Invalid payload → EvidencePoolValidationError.
 */
export function extractEvidenceFiles(body: unknown): EvidencePoolFileInput[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }
  const raw = (body as { evidence_files?: unknown }).evidence_files;
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new EvidencePoolValidationError('evidence_files must be an array', [
      { field: 'evidence_files', message: '须为数组' },
    ]);
  }
  if (raw.length === 0) {
    return [];
  }
  if (raw.length > EVIDENCE_POOL_MAX_FILES) {
    throw new EvidencePoolValidationError(
      `最多上传 ${EVIDENCE_POOL_MAX_FILES} 份支撑材料`,
      [
        {
          field: 'evidence_files',
          message: `最多 ${EVIDENCE_POOL_MAX_FILES} 个文件`,
        },
      ],
    );
  }

  const issues: EvidencePoolIssue[] = [];
  const files: EvidencePoolFileInput[] = [];

  raw.forEach((item, index) => {
    const field = `evidence_files[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      issues.push({ field, message: '须为对象' });
      return;
    }
    const record = item as Record<string, unknown>;
    const filename = typeof record.filename === 'string' ? record.filename.trim() : '';
    if (!filename) {
      issues.push({ field: `${field}.filename`, message: '文件名不能为空' });
      return;
    }
    const ext = extensionOf(filename);
    if (!(EVIDENCE_POOL_EXTENSIONS as readonly string[]).includes(ext)) {
      issues.push({
        field: `${field}.filename`,
        message: '仅支持 PDF、TXT 或 MD（文字层文件）',
      });
      return;
    }
    const contentBase64 =
      typeof record.content_base64 === 'string' ? record.content_base64.trim() : '';
    if (!contentBase64) {
      issues.push({ field: `${field}.content_base64`, message: '文件内容不能为空' });
      return;
    }
    const bytes = decodedByteLength(contentBase64);
    if (bytes > EVIDENCE_POOL_MAX_BYTES) {
      issues.push({
        field: `${field}.content_base64`,
        message: `单个文件不超过 ${EVIDENCE_POOL_MAX_BYTES / (1024 * 1024)}MB`,
      });
      return;
    }
    const rawType =
      typeof record.evidence_source_type === 'string'
        ? record.evidence_source_type.trim()
        : '';
    let sourceType: EvidenceSourceType = 'INTERNAL_TEST';
    if (rawType) {
      if (!isEvidenceSourceType(rawType)) {
        issues.push({
          field: `${field}.evidence_source_type`,
          message: '材料类型无效',
        });
        return;
      }
      sourceType = rawType;
    }
    const mime =
      typeof record.mime_type === 'string' && record.mime_type.trim()
        ? record.mime_type.trim()
        : ext === '.pdf'
          ? 'application/pdf'
          : ext === '.md'
            ? 'text/markdown'
            : 'text/plain';

    files.push({
      filename,
      mime_type: mime,
      content_base64: contentBase64,
      evidence_source_type: sourceType,
    });
  });

  if (issues.length > 0) {
    throw new EvidencePoolValidationError(
      issues.map((issue) => `${issue.field}: ${issue.message}`).join('; '),
      issues,
    );
  }
  return files;
}
