import { typeText } from '@cs/core/testing';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { as, renderApp } from '../../test/renderApp';

describe('sign in', () => {
  it('signs in with the email and password entered', async () => {
    const { fake } = renderApp('/sign-in', as.signedOut);

    await typeText(await screen.findByLabelText('Email'), '  Owner@Alpha.test ');
    await typeText(screen.getByLabelText('Password'), 'Shield-Strong-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(fake.mocks.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@alpha.test',
      password: 'Shield-Strong-2026',
    });
  });

  it('explains a wrong password in plain words', async () => {
    const { fake } = renderApp('/sign-in', as.signedOut);
    fake.mocks.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    } as never);

    await typeText(await screen.findByLabelText('Email'), 'owner@alpha.test');
    await typeText(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('asks for both fields before contacting the server', async () => {
    const { fake } = renderApp('/sign-in', as.signedOut);
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your email and password.');
    expect(fake.mocks.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('moves on to the code screen once signed in', async () => {
    const { fake, path } = renderApp('/sign-in', as.signedOut);
    fake.mocks.auth.signInWithPassword.mockImplementationOnce(async () => {
      Object.assign(fake.state, as.needsMfaCode);
      fake.emit('SIGNED_IN');
      return { data: { user: null, session: null }, error: null } as never;
    });

    await typeText(await screen.findByLabelText('Email'), 'owner@alpha.test');
    await typeText(screen.getByLabelText('Password'), 'Shield-Strong-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(path()).toBe('/mfa/verify'));
  });

  it('links to sign up and password reset', async () => {
    renderApp('/sign-in', as.signedOut);
    expect(await screen.findByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
