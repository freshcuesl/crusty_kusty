import { describe, expect, it } from 'vitest';
import { friendlyError } from './friendlyError';

describe('friendlyError', () => {
  it.each([
    ['invalid_credentials', 'Email or password is incorrect.'],
    ['email_not_confirmed', 'Confirm your email first. Check your inbox for the link.'],
    ['over_request_rate_limit', 'Too many attempts. Wait a minute, then try again.'],
    ['over_email_send_rate_limit', 'Too many emails sent. Wait a minute, then try again.'],
    [
      'mfa_verification_failed',
      "That code didn't work. Check your authenticator app and try again.",
    ],
    ['mfa_challenge_expired', 'That code expired. Enter the newest code from your app.'],
    ['weak_password', 'Choose a stronger password that meets every rule below.'],
    ['same_password', 'Choose a password you have not used before.'],
  ])('explains %s in plain words', (code, message) => {
    expect(friendlyError({ code, message: 'raw server text' })).toBe(message);
  });

  it('uses the database message for errors raised by our own functions', () => {
    expect(friendlyError({ code: '23505', message: 'You already belong to a business' })).toBe(
      'You already belong to a business',
    );
    expect(
      friendlyError({
        code: 'P0002',
        message: 'Invite not found, expired, or for a different email',
      }),
    ).toBe('Invite not found, expired, or for a different email');
  });

  it('never shows raw technical errors', () => {
    expect(
      friendlyError({ code: 'unexpected_failure', message: 'pq: relation does not exist' }),
    ).toBe('Something went wrong. Try again in a moment.');
    expect(friendlyError(new TypeError('Failed to fetch'))).toBe(
      "Can't reach the server. Check your connection and try again.",
    );
    expect(friendlyError(undefined)).toBe('Something went wrong. Try again in a moment.');
  });
});
