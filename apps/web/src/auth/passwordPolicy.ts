export interface PasswordRule {
  label: string;
  test: (password: string) => boolean;
}

// Must match supabase/config.toml (minimum_password_length, password_requirements).
// Supabase Auth checks these exact character sets.
const SYMBOLS = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~';

export const passwordRules: PasswordRule[] = [
  { label: 'At least 12 characters', test: (p) => [...p].length >= 12 },
  { label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'A number', test: (p) => /[0-9]/.test(p) },
  { label: 'A symbol, like ! or #', test: (p) => [...p].some((c) => SYMBOLS.includes(c)) },
];

export function unmetPasswordRules(password: string): PasswordRule[] {
  return passwordRules.filter((rule) => !rule.test(password));
}
