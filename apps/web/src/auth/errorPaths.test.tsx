import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { as, renderApp } from '../test/renderApp';

const refused = (code: string, message = 'server said no') =>
  ({ data: null, error: { code, message } }) as never;

describe('when things go wrong', () => {
  it('sign-up asks for a name and email before anything else', async () => {
    const { fake } = renderApp('/sign-up', as.signedOut);
    await userEvent.click(await screen.findByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your name and email.');
    expect(fake.mocks.auth.signUp).not.toHaveBeenCalled();
  });

  it('sign-up explains a rate limit from the server', async () => {
    const { fake } = renderApp('/sign-up', as.signedOut);
    fake.mocks.auth.signUp.mockResolvedValueOnce(refused('over_email_send_rate_limit'));
    await userEvent.type(await screen.findByLabelText('Your name'), 'Olive');
    await userEvent.type(screen.getByLabelText('Email'), 'o@alpha.test');
    await userEvent.type(screen.getByLabelText('Password'), 'Crusty-Krab-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many emails sent');
  });

  it('sign-in explains a lost connection', async () => {
    const { fake } = renderApp('/sign-in', as.signedOut);
    fake.mocks.auth.signInWithPassword.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await userEvent.type(await screen.findByLabelText('Email'), 'o@alpha.test');
    await userEvent.type(screen.getByLabelText('Password'), 'anything-at-all');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server");
  });

  it('forgot-password asks for an email first', async () => {
    const { fake } = renderApp('/forgot-password', as.signedOut);
    await userEvent.click(await screen.findByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your email.');
    expect(fake.mocks.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('forgot-password shows rate limits but hides every other server answer', async () => {
    const { fake } = renderApp('/forgot-password', as.signedOut);
    fake.mocks.auth.resetPasswordForEmail.mockResolvedValueOnce(refused('over_request_rate_limit'));
    await userEvent.type(await screen.findByLabelText('Email'), 'o@alpha.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');

    fake.mocks.auth.resetPasswordForEmail.mockResolvedValueOnce(refused('user_not_found'));
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists');
  });

  it('reset-password shows a server refusal', async () => {
    const { fake } = renderApp('/reset-password', as.owner);
    fake.mocks.auth.updateUser.mockResolvedValueOnce(refused('same_password'));
    await userEvent.type(await screen.findByLabelText('New password'), 'Brand-New-Krab-9');
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not used before');
  });

  it('authenticator setup explains when the QR code cannot be created', async () => {
    const { fake } = renderApp('/mfa/setup', as.needsMfaSetup);
    fake.mocks.auth.mfa.enroll.mockResolvedValueOnce(refused('mfa_totp_enroll_not_enabled'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('authenticator setup explains a wrong code', async () => {
    const { fake } = renderApp('/mfa/setup', as.needsMfaSetup);
    fake.mocks.auth.mfa.challengeAndVerify.mockResolvedValueOnce(
      refused('mfa_verification_failed'),
    );
    await userEvent.type(await screen.findByLabelText('6-digit code'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on two-step login' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work");
  });

  it('code screen only accepts 6 digits', async () => {
    const { fake } = renderApp('/mfa/verify', as.needsMfaCode);
    await userEvent.type(await screen.findByLabelText('6-digit code'), '12');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the 6-digit code');
    expect(fake.mocks.auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it('team page explains a refused invite', async () => {
    const { fake } = renderApp('/team', as.owner);
    fake.mocks.rpc.mockImplementation(async (name: string) =>
      name === 'create_invite'
        ? refused('22023', 'Enter a valid email address')
        : ({ data: [], error: null } as never),
    );
    await userEvent.type(await screen.findByLabelText('Their email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address');
  });

  it('team page tells the user how to copy by hand if copying fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    const { fake } = renderApp('/team', as.owner);
    fake.mocks.rpc.mockImplementation(async (name: string) =>
      name === 'create_invite'
        ? ({ data: 'tok', error: null } as never)
        : ({ data: [], error: null } as never),
    );
    await userEvent.type(await screen.findByLabelText('Their email'), 'n@alpha.test');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite link' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Press and hold the link');
  });

  it('team page shows when the team cannot be loaded', async () => {
    const { fake } = renderApp('/team', as.owner);
    fake.mocks.rpc.mockResolvedValue(refused('42501', 'Two-step login required'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Two-step login required');
  });

  it('security page lets the user back out of adding a backup', async () => {
    renderApp('/account/security', as.owner);
    await userEvent.click(await screen.findByRole('button', { name: 'Add backup authenticator' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Add backup authenticator' })).toBeInTheDocument();
  });

  it('security page keeps the device when the removal is cancelled', async () => {
    const { fake } = renderApp('/account/security', {
      ...as.owner,
      factors: [
        { id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' },
        { id: 'f2', factor_type: 'totp', status: 'verified', friendly_name: 'Tablet' },
      ],
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Tablet' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(fake.mocks.auth.mfa.unenroll).not.toHaveBeenCalled();
  });
});
