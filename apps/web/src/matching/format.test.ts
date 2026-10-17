import { describe, expect, it } from 'vitest';
import { DECISION_LABELS, formatMonth } from './format';

describe('formatMonth', () => {
  it('turns 2026-03 into March 2026', () => {
    expect(formatMonth('2026-03')).toBe('March 2026');
  });

  it('is empty when there is no month', () => {
    expect(formatMonth(null)).toBe('');
  });
});

describe('DECISION_LABELS', () => {
  it('offers the three choices from the product spec', () => {
    expect(Object.values(DECISION_LABELS)).toEqual([
      'Continue booking',
      'Require additional authorization',
      'Decline job',
    ]);
  });
});
