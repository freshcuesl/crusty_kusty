import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { as, ownerMembership, renderApp } from '../../test/renderApp';

afterEach(() => sessionStorage.clear());

describe('creating a business', () => {
  it('creates the business and opens the app', async () => {
    const { fake, path } = renderApp('/onboarding', as.needsBusiness);
    fake.mocks.rpc.mockImplementationOnce(async () => {
      fake.state.membership = ownerMembership;
      return { data: 'b1', error: null } as never;
    });

    await userEvent.type(await screen.findByLabelText('Business name'), 'Alpha Plumbing');
    await userEvent.click(screen.getByRole('button', { name: 'Create business' }));

    expect(fake.mocks.rpc).toHaveBeenCalledWith('create_business', { p_name: 'Alpha Plumbing' });
    await waitFor(() => expect(path()).toBe('/'));
  });

  it('shows the database reason when creation is refused', async () => {
    const { fake } = renderApp('/onboarding', as.needsBusiness);
    fake.mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '22023', message: 'Business name must be 2 to 120 characters' },
    } as never);

    await userEvent.type(await screen.findByLabelText('Business name'), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Create business' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Business name must be 2 to 120 characters',
    );
  });

  it('tells staff to use their invite link instead', async () => {
    renderApp('/onboarding', as.needsBusiness);
    expect(
      await screen.findByText(/ask the owner to send you an invite link/i),
    ).toBeInTheDocument();
  });
});

describe('joining with an invite link', () => {
  it('remembers the invite while a new person signs up', async () => {
    const { path } = renderApp('/invite/tok_123', as.signedOut);
    await waitFor(() => expect(path()).toBe('/sign-up'));
    expect(sessionStorage.getItem('cs.pendingInvite')).toBe('tok_123');
  });

  it('joins the team once the person is signed in with two-step login', async () => {
    sessionStorage.setItem('cs.pendingInvite', 'tok_123');
    const { fake, path } = renderApp('/onboarding', as.needsBusiness);
    fake.mocks.rpc.mockImplementationOnce(async () => {
      fake.state.membership = { ...ownerMembership, role: 'staff' };
      return { data: 'b1', error: null } as never;
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Join the team' }));

    expect(fake.mocks.rpc).toHaveBeenCalledWith('accept_invite', { p_token: 'tok_123' });
    await waitFor(() => expect(path()).toBe('/'));
    expect(sessionStorage.getItem('cs.pendingInvite')).toBeNull();
  });

  it('explains an invite that no longer works and lets them discard it', async () => {
    sessionStorage.setItem('cs.pendingInvite', 'tok_old');
    const { fake } = renderApp('/onboarding', as.needsBusiness);
    fake.mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'P0002', message: 'Invite not found, expired, or for a different email' },
    } as never);

    await userEvent.click(await screen.findByRole('button', { name: 'Join the team' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invite not found');

    await userEvent.click(screen.getByRole('button', { name: 'Forget this invite' }));
    expect(sessionStorage.getItem('cs.pendingInvite')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Join the team' })).not.toBeInTheDocument();
  });

  it('tells someone who already has a business', async () => {
    renderApp('/invite/tok_123', as.owner);
    expect(await screen.findByText(/already belong to Alpha Plumbing/)).toBeInTheDocument();
  });
});
