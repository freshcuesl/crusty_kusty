import { describe, expect, it } from 'vitest';
import { currentIdentity, identityReason } from './identity';

describe('currentIdentity', () => {
  it('is empty before any attempt', () => {
    expect(currentIdentity([])).toBeNull();
  });

  it('prefers a passed check over a newer abandoned one', () => {
    expect(
      currentIdentity([
        { status: 'canceled', last_error_code: null, updated_at: '2' },
        { status: 'verified', last_error_code: null, updated_at: '1' },
      ])?.status,
    ).toBe('verified');
  });

  it('otherwise uses the newest attempt', () => {
    expect(
      currentIdentity([
        { status: 'requires_input', last_error_code: 'document_expired', updated_at: '2' },
        { status: 'canceled', last_error_code: null, updated_at: '1' },
      ])?.last_error_code,
    ).toBe('document_expired');
  });
});

describe('identityReason', () => {
  it('explains known Stripe reasons in plain words', () => {
    expect(identityReason('document_expired')).toBe('Your ID has expired. Use a current one.');
  });

  it('falls back to a general message', () => {
    expect(identityReason('something_new')).toBe("Stripe couldn't verify your ID.");
    expect(identityReason(null)).toBe("Stripe couldn't verify your ID.");
  });
});
