import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { as, renderApp } from '../../test/renderApp';

describe('forgot password', () => {
  it('sends a reset link that returns to the reset page', async () => {
    const { fake } = renderApp('/forgot-password', as.signedOut);
    await userEvent.type(await screen.findByLabelText('Email'), 'owner@alpha.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(fake.mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith('owner@alpha.test', {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it('gives the same answer whether or not the account exists', async () => {
    renderApp('/forgot-password', as.signedOut);
    await userEvent.type(await screen.findByLabelText('Email'), 'nobody@else.test');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account exists for nobody@else.test, a reset link is on its way.',
    );
  });
});

describe('reset password', () => {
  it('requires the authenticator code before a new password can be set', async () => {
    const { path } = renderApp('/reset-password', as.needsMfaCode);
    await waitFor(() => expect(path()).toBe('/mfa/verify'));
  });

  it('saves a strong new password', async () => {
    const { fake } = renderApp('/reset-password', as.owner);
    await userEvent.type(await screen.findByLabelText('New password'), 'Brand-New-Krab-9');
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));

    expect(fake.mocks.auth.updateUser).toHaveBeenCalledWith({ password: 'Brand-New-Krab-9' });
    expect(await screen.findByRole('status')).toHaveTextContent('Password updated');
  });

  it('rejects a weak new password without calling the server', async () => {
    const { fake } = renderApp('/reset-password', as.owner);
    await userEvent.type(await screen.findByLabelText('New password'), 'weak');
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(fake.mocks.auth.updateUser).not.toHaveBeenCalled();
  });
});
