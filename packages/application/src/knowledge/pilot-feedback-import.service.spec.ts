import { describe, expect, it } from 'vitest';
import {
  mapPilotRowToFeedbackInput,
  parsePilotCsv,
} from './pilot-feedback-import.service.js';

describe('PilotFeedbackImportService', () => {
  it('parses quoted CSV and maps DISAGREE_DECISION to GAP category', () => {
    const csv = [
      'pilot_id,case_id,human_decision,human_rationale,agreement,issue_type',
      'P-001,pilot-p001-sg,WARN,"perfect+every time",DISAGREE_DECISION,GAP',
    ].join('\n');

    const rows = parsePilotCsv(csv);
    const input = mapPilotRowToFeedbackInput(rows[0]!);

    expect(input.caseId).toBe('pilot-p001-sg');
    expect(input.pilotId).toBe('P-001');
    expect(input.decision).toBe('WARN');
    expect(input.metadata.category).toBe('GAP');
  });
});
