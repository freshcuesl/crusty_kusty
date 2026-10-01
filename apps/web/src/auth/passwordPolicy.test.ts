import { describe, expect, it } from 'vitest';
import { passwordRules, unmetPasswordRules } from './passwordPolicy';

describe('password policy', () => {
  it('matches the server rules: 12+ characters with lower, upper, digit and symbol', () => {
    expect(passwordRules.map((r) => r.label)).toEqual([
      'At least 12 characters',
      'A lowercase letter',
      'An uppercase letter',
      'A number',
      'A symbol, like ! or #',
    ]);
  });

  it('accepts a strong password', () => {
    expect(unmetPasswordRules('Shield-Strong-2026')).toEqual([]);
  });

  it('lists every rule an empty password misses', () => {
    expect(unmetPasswordRules('')).toHaveLength(5);
  });

  it.each([
    ['Sh0rt!pass', 'At least 12 characters'],
    ['ALLUPPERCASE123!', 'A lowercase letter'],
    ['alllowercase123!', 'An uppercase letter'],
    ['NoNumbersHere!!', 'A number'],
    ['NoSymbolsHere123', 'A symbol, like ! or #'],
  ])('%s is missing "%s"', (password, missing) => {
    expect(unmetPasswordRules(password).map((r) => r.label)).toEqual([missing]);
  });

  it('matches the server: an accented capital does not count as an uppercase letter', () => {
    // Supabase Auth checks against plain A-Z, a-z, 0-9 and a fixed symbol list.
    expect(unmetPasswordRules('Éééééééééé1!a').map((r) => r.label)).toEqual([
      'An uppercase letter',
    ]);
  });
});
