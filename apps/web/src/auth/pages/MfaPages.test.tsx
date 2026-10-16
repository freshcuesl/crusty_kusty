import { typeText } from '@cs/core/testing';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { as, renderApp } from '../../test/renderApp';

describe('setting up the authenticator app', () => {
  it('shows a QR code and a key for typing in by hand', async () => {
    renderApp('/mfa/setup', as.needsMfaSetup);

    expect(
      await screen.findByRole('img', { name: 'QR code for your authenticator app' }),
    ).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
  });

  it('enrolls exactly one authenticator, even when React renders twice', async () => {
    const { fake } = renderApp('/mfa/setup', as.needsMfaSetup);
    await screen.findByText('JBSWY3DPEHPK3PXP');
    expect(fake.mocks.auth.mfa.enroll).toHaveBeenCalledTimes(1);
    expect(fake.mocks.auth.mfa.enroll).toHaveBeenCalledWith({
      factorType: 'totp',
      friendlyName: expect.stringMatching(/^Authenticator app/),
      // The name shown next to the code in the user's authenticator app.
      issuer: 'ClientShield',
    });
  });

  it('clears out a half-finished setup from an earlier visit first', async () => {
    const { fake } = renderApp('/mfa/setup', {
      ...as.needsMfaSetup,
      factors: [{ id: 'stale', factor_type: 'totp', status: 'unverified' }],
    });
    await screen.findByText('JBSWY3DPEHPK3PXP');
    expect(fake.mocks.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'stale' });
  });

  it('checks the 6-digit code and continues', async () => {
    const { fake, path } = renderApp('/mfa/setup', as.needsMfaSetup);
    fake.mocks.auth.mfa.challengeAndVerify.mockImplementationOnce(async () => {
      Object.assign(fake.state, as.needsBusiness);
      return { data: {}, error: null } as never;
    });

    await typeText(await screen.findByLabelText('6-digit code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on two-step login' }));

    expect(fake.mocks.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: 'factor-new',
      code: '123456',
    });
    await waitFor(() => expect(path()).toBe('/onboarding'));
  });

  it('only accepts 6 digits', async () => {
    const { fake } = renderApp('/mfa/setup', as.needsMfaSetup);
    await typeText(await screen.findByLabelText('6-digit code'), '12a4');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on two-step login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the 6-digit code');
    expect(fake.mocks.auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
  });
});

describe('entering the code at sign-in', () => {
  it('verifies the code against the account authenticator', async () => {
    const { fake, path } = renderApp('/mfa/verify', as.needsMfaCode);
    fake.mocks.auth.mfa.challengeAndVerify.mockImplementationOnce(async () => {
      Object.assign(fake.state, as.owner);
      return { data: {}, error: null } as never;
    });

    await typeText(await screen.findByLabelText('6-digit code'), '654321');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(fake.mocks.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: 'f1',
      code: '654321',
    });
    await waitFor(() => expect(path()).toBe('/'));
  });

  it('explains a wrong code', async () => {
    const { fake } = renderApp('/mfa/verify', as.needsMfaCode);
    fake.mocks.auth.mfa.challengeAndVerify.mockResolvedValueOnce({
      data: null,
      error: { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' },
    } as never);

    await typeText(await screen.findByLabelText('6-digit code'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work");
  });

  it('lets the user pick which device when they have a backup', async () => {
    const { fake } = renderApp('/mfa/verify', {
      ...as.needsMfaCode,
      factors: [
        { id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' },
        { id: 'f2', factor_type: 'totp', status: 'verified', friendly_name: 'Tablet' },
      ],
    });

    await userEvent.click(await screen.findByRole('radio', { name: 'Tablet' }));
    await typeText(screen.getByLabelText('6-digit code'), '111111');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(fake.mocks.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: 'f2',
      code: '111111',
    });
  });

  it('offers a way out to sign in as someone else', async () => {
    const { fake } = renderApp('/mfa/verify', as.needsMfaCode);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(fake.mocks.auth.signOut).toHaveBeenCalled();
  });
});
