import { describe, expect, it } from 'vitest';
import { toDecisionResponseDto } from './decision.dto.js';

describe('decision.dto', () => {
  it('maps ReviewDecisionResult to snake_case response', () => {
    const dto = toDecisionResponseDto({
      reviewId: 'rev_test',
      finalDecision: 'REJECT',
      confidence: 1,
      rationale: 'Rule BLOCKER finding requires rejection.',
      findingCounts: { rule: 1, playbook: 2, llm: 0 },
      decidedAt: '2026-06-26T10:09:00.000Z',
    });

    expect(dto).toEqual({
      review_id: 'rev_test',
      final_decision: 'REJECT',
      confidence: 1,
      rationale: 'Rule BLOCKER finding requires rejection.',
      finding_counts: { rule: 1, playbook: 2, llm: 0 },
      decided_at: '2026-06-26T10:09:00.000Z',
    });
  });
});
