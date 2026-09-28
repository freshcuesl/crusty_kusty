import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { as, renderApp } from '../../test/renderApp';

async function fillForm(password = 'Crusty-Krab-2026') {
  await userEvent.type(await screen.findByLabelText('Your name'), 'Olive Owner');
  await userEvent.type(screen.getByLabelText('Email'), 'Owner@Alpha.test');
  await userEvent.type(screen.getByLabelText('Password'), password);
}

describe('sign up', () => {
  it('creates the account and asks the user to confirm their email', async () => {
    const { fake, path } = renderApp('/sign-up', as.signedOut);

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(fake.mocks.auth.signUp).toHaveBeenCalledWith({
      email: 'owner@alpha.test',
      password: 'Crusty-Krab-2026',
      options: {
        data: { full_name: 'Olive Owner' },
        emailRedirectTo: `${window.location.origin}/sign-in`,
      },
    });
    await waitFor(() => expect(path()).toBe('/check-email'));
    expect(screen.getByText('owner@alpha.test')).toBeInTheDocument();
  });

  it('shows which password rules are still missing as the user types', async () => {
    renderApp('/sign-up', as.signedOut);
    await userEvent.type(await screen.findByLabelText('Password'), 'short');

    const rules = screen.getByRole('list', { name: 'Password rules' });
    expect(rules).toHaveTextContent('At least 12 characters');
    expect(screen.getByText('A lowercase letter').closest('li')).toHaveAttribute(
      'data-met',
      'true',
    );
    expect(screen.getByText('A number').closest('li')).toHaveAttribute('data-met', 'false');
  });

  it('does not send a weak password to the server', async () => {
    const { fake } = renderApp('/sign-up', as.signedOut);
    await fillForm('weakpassword');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a stronger password that meets every rule below.',
    );
    expect(fake.mocks.auth.signUp).not.toHaveBeenCalled();
  });

  it('can show the password to check for typos', async () => {
    renderApp('/sign-up', as.signedOut);
    const field = await screen.findByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
  });
});
