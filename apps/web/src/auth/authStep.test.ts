import { describe, expect, it } from 'vitest';
import { pathForStep, resolveAuthStep, type AuthSnapshot } from './authStep';

const signedIn: AuthSnapshot = {
  loading: false,
  hasSession: true,
  currentLevel: 'aal2',
  nextLevel: 'aal2',
  membership: {
    role: 'owner',
    businessId: 'b1',
    businessName: 'Alpha',
    verificationStatus: 'unverified',
  },
};

describe('resolveAuthStep', () => {
  it('waits while the session is loading', () => {
    expect(resolveAuthStep({ ...signedIn, loading: true })).toBe('loading');
  });

  it('sends visitors without a session to sign in', () => {
    expect(resolveAuthStep({ ...signedIn, hasSession: false })).toBe('signed-out');
  });

  it('asks for the authenticator code when the account has one but this session has not used it', () => {
    expect(resolveAuthStep({ ...signedIn, currentLevel: 'aal1', nextLevel: 'aal2' })).toBe(
      'mfa-verify',
    );
  });

  it('requires setting up an authenticator when the account has none', () => {
    expect(resolveAuthStep({ ...signedIn, currentLevel: 'aal1', nextLevel: 'aal1' })).toBe(
      'mfa-setup',
    );
  });

  it('sends users without a business to onboarding', () => {
    expect(resolveAuthStep({ ...signedIn, membership: null })).toBe('onboarding');
  });

  it('lets fully set-up users into the app', () => {
    expect(resolveAuthStep(signedIn)).toBe('ready');
  });

  it('treats an unknown assurance level as not verified', () => {
    expect(resolveAuthStep({ ...signedIn, currentLevel: null, nextLevel: null })).toBe('mfa-setup');
  });
});

describe('pathForStep', () => {
  it.each([
    ['signed-out', '/sign-in'],
    ['mfa-setup', '/mfa/setup'],
    ['mfa-verify', '/mfa/verify'],
    ['onboarding', '/onboarding'],
    ['ready', '/'],
  ] as const)('%s → %s', (step, path) => {
    expect(pathForStep(step)).toBe(path);
  });
});
