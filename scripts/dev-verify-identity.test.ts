import { describe, expect, it } from 'vitest';
import { localIdentityRow, parseEmailArg } from './dev-verify-identity.mjs';

describe('parseEmailArg', () => {
  it('reads and normalizes the email', () => {
    expect(parseEmailArg(['Owner@Alpha.test'])).toBe('owner@alpha.test');
  });

  it('explains usage when the email is missing', () => {
    expect(() => parseEmailArg([])).toThrow(/npm run dev:verify-identity -- you@example.com/);
  });
});

describe('localIdentityRow', () => {
  it('builds a verified check that is clearly marked as a local stand-in', () => {
    expect(localIdentityRow('u1', 'b1', () => 'abc123')).toEqual({
      business_id: 'b1',
      user_id: 'u1',
      stripe_session_id: 'vs_localdev_abc123',
      status: 'verified',
    });
  });
});
