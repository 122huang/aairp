import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CreateFeedbackInput, IFeedbackRepository } from '@aairp/shared-kernel';

export type PilotFeedbackImportItemResult = {
  case_id: string;
  pilot_id: string;
  action: 'imported' | 'updated';
};

export type PilotFeedbackImportResult = {
  imported: number;
  updated: number;
  items: PilotFeedbackImportItemResult[];
};

export type PilotFeedbackImportServiceDeps = {
  feedbackRepository: IFeedbackRepository;
};

const packageDir = dirname(fileURLToPath(import.meta.url));

export function resolvePilotLogPath(customPath?: string): string {
  if (customPath) {
    return customPath;
  }
  if (process.env.AAIRP_PILOT_LOG_PATH) {
    return process.env.AAIRP_PILOT_LOG_PATH;
  }
  return join(packageDir, '../../../../pilot/pilot-ad-log.csv');
}

export function parsePilotCsv(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]!);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

export function mapPilotRowToFeedbackInput(row: Record<string, string>): CreateFeedbackInput {
  const issueType = row.issue_type?.trim();
  const agreement = row.agreement?.trim();

  return {
    caseId: row.case_id?.trim() || undefined,
    pilotId: row.pilot_id?.trim() || undefined,
    decision: row.human_decision?.trim() || undefined,
    comment: row.human_rationale?.trim() || undefined,
    reviewerId: row.reviewer?.trim() || undefined,
    metadata: {
      source: row.source?.trim() || 'pilot-csv',
      track: row.track?.trim() || undefined,
      country_id: row.country_id?.trim() || undefined,
      category_id: row.category_id?.trim() || undefined,
      platform_id: row.platform_id?.trim() || undefined,
      intent_label: row.intent_label?.trim() || undefined,
      ad_text: row.ad_text?.trim() || undefined,
      ai_decision: row.ai_decision?.trim() || undefined,
      agreement: agreement || undefined,
      issue_type: issueType || undefined,
      category: agreement === 'DISAGREE_DECISION' ? 'GAP' : issueType || undefined,
      severity: row.severity?.trim() || undefined,
      reviewed_at: row.reviewed_at?.trim() || undefined,
    },
  };
}

export class PilotFeedbackImportService {
  constructor(private readonly deps: PilotFeedbackImportServiceDeps) {}

  async importFromCsv(csvPath: string): Promise<PilotFeedbackImportResult> {
    const content = await readFile(csvPath, 'utf8');
    const rows = parsePilotCsv(content);
    const items: PilotFeedbackImportItemResult[] = [];

    for (const row of rows) {
      const input = mapPilotRowToFeedbackInput(row);
      if (!input.caseId) {
        continue;
      }

      const result = await this.deps.feedbackRepository.upsertByCaseId(input);
      items.push({
        case_id: input.caseId,
        pilot_id: input.pilotId ?? '',
        action: result.created ? 'imported' : 'updated',
      });
    }

    return {
      imported: items.filter((item) => item.action === 'imported').length,
      updated: items.filter((item) => item.action === 'updated').length,
      items,
    };
  }
}
