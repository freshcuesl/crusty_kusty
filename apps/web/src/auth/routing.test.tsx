import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { as, renderApp } from '../test/renderApp';

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

describe('who can see what', () => {
  it.each([
    ['a visitor', as.signedOut, '/sign-in'],
    ['a new account without an authenticator', as.needsMfaSetup, '/mfa/setup'],
    ['an account that has not entered its code', as.needsMfaCode, '/mfa/verify'],
    ['a verified user without a business', as.needsBusiness, '/onboarding'],
  ])('%s opening the home screen is sent to %s', async (_who, state, expected) => {
    const { path } = renderApp('/', state);
    await waitFor(() => expect(path()).toBe(expected));
  });

  it('a fully set-up owner reaches the home screen', async () => {
    renderApp('/', as.owner);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'What do you need?' }),
    ).toBeInTheDocument();
  });

  it('signed-in users are moved off the sign-in page', async () => {
    const { path } = renderApp('/sign-in', as.owner);
    await waitFor(() => expect(path()).toBe('/'));
  });

  it('nobody can skip the code screen by typing another address', async () => {
    const { path } = renderApp('/incidents', as.needsMfaCode);
    await waitFor(() => expect(path()).toBe('/mfa/verify'));
  });

  it('returns users to the page they asked for after signing in', async () => {
    const { path, fake } = renderApp('/alerts', as.signedOut);
    await waitFor(() => expect(path()).toBe('/sign-in'));

    Object.assign(fake.state, as.owner);
    fake.emit('SIGNED_IN');

    await waitFor(() => expect(path()).toBe('/alerts'));
  });

  it('shows a loading state instead of flashing the sign-in page', () => {
    renderApp('/', as.owner);
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();
  });
});
