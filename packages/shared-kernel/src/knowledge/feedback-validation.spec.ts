import { describe, expect, it } from 'vitest';
import { validateFeedbackRatings } from './feedback-validation.js';

describe('validateFeedbackRatings', () => {
  it('accepts scores from 1 to 5', () => {
    expect(() =>
      validateFeedbackRatings({ decision_accuracy: 4, report_usability: 5 }),
    ).not.toThrow();
  });

  it('rejects out-of-range scores', () => {
    expect(() => validateFeedbackRatings({ decision_accuracy: 6 })).toThrow();
  });
});
