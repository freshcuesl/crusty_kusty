/** Converts what people type into the stored +1XXXXXXXXXX form, or null if it isn't a US number. */
export function normalizeUsPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  // US area codes never start with 0 or 1.
  if (!/^[2-9]\d{9}$/.test(digits)) return null;
  return `+1${digits}`;
}

export function formatUsPhone(stored: string): string {
  const match = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(stored);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : stored;
}
