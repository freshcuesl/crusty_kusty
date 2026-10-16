import { describe, expect, it } from 'vitest';
import { formatUsPhone, normalizeUsPhone } from './phone';

describe('normalizeUsPhone', () => {
  it.each([
    ['(206) 555-0100', '+12065550100'],
    ['206.555.0100', '+12065550100'],
    ['1 206 555 0100', '+12065550100'],
    ['+1 206-555-0100', '+12065550100'],
  ])('turns %s into %s', (input, expected) => {
    expect(normalizeUsPhone(input)).toBe(expected);
  });

  it.each(['555-0100', '206555010', '+44 20 7946 0958', '(106) 555-0100', ''])(
    'rejects %s',
    (input) => {
      expect(normalizeUsPhone(input)).toBeNull();
    },
  );
});

describe('formatUsPhone', () => {
  it('shows stored numbers the way people write them', () => {
    expect(formatUsPhone('+12065550100')).toBe('(206) 555-0100');
  });

  it('leaves anything unexpected alone', () => {
    expect(formatUsPhone('oops')).toBe('oops');
  });
});
