import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { as, ownerMembership, renderApp } from '../test/renderApp';

const team = [
  { user_id: 'u1', full_name: 'Olive Owner', email: 'owner@alpha.test', role: 'owner' },
  { user_id: 'u2', full_name: 'Sam Staff', email: 'staff@alpha.test', role: 'staff' },
];

describe('account menu', () => {
  it('opens Security, Team and Sign out from the header', async () => {
    const { fake, path } = renderApp('/', as.owner);
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Team' }));
    await waitFor(() => expect(path()).toBe('/team'));

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(fake.mocks.auth.signOut).toHaveBeenCalled();
  });
});

describe('team page', () => {
  it('lists everyone on the team with their role', async () => {
    renderApp('/team', { ...as.owner, rpc: { team_members: team } });
    const list = await screen.findByRole('list', { name: 'Team members' });
    expect(await within(list).findByText('Olive Owner')).toBeInTheDocument();
    expect(within(list).getByText('staff@alpha.test')).toBeInTheDocument();
    expect(within(list).getByText('Staff')).toBeInTheDocument();
  });

  it('creates an invite link for a new staff member', async () => {
    const { fake } = renderApp('/team', { ...as.owner, rpc: { team_members: team } });
    fake.mocks.rpc.mockImplementation(async (name: string) =>
      name === 'create_invite'
        ? ({ data: 'tok_abc', error: null } as never)
        : ({ data: team, error: null } as never),
    );

    await userEvent.type(await screen.findByLabelText('Their email'), 'new@alpha.test');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite link' }));

    expect(fake.mocks.rpc).toHaveBeenCalledWith('create_invite', {
      p_business_id: 'b1',
      p_email: 'new@alpha.test',
    });
    expect(
      await screen.findByDisplayValue(`${window.location.origin}/invite/tok_abc`),
    ).toBeInTheDocument();
    expect(screen.getByText(/works once, for new@alpha.test, for 7 days/)).toBeInTheDocument();
  });

  it('copies the invite link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { fake } = renderApp('/team', as.owner);
    fake.mocks.rpc.mockImplementation(async (name: string) =>
      name === 'create_invite'
        ? ({ data: 'tok_abc', error: null } as never)
        : ({ data: [], error: null } as never),
    );

    await userEvent.type(await screen.findByLabelText('Their email'), 'new@alpha.test');
    await userEvent.click(screen.getByRole('button', { name: 'Create invite link' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/tok_abc`);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('shows pending invites and can cancel one', async () => {
    const { fake } = renderApp('/team', {
      ...as.owner,
      tables: {
        business_invites: [
          { id: 'i1', email: 'late@alpha.test', expires_at: '2026-10-05T00:00:00Z' },
        ],
      },
    });
    const pending = await screen.findByRole('list', { name: 'Pending invites' });
    await userEvent.click(
      within(pending).getByRole('button', { name: 'Cancel invite for late@alpha.test' }),
    );

    expect(fake.mocks.from).toHaveBeenCalledWith('business_invites');
    expect(fake.query.delete).toHaveBeenCalled();
    expect(fake.query.eq).toHaveBeenCalledWith('id', 'i1');
  });

  it('removes a staff member after confirming', async () => {
    const { fake } = renderApp('/team', { ...as.owner, rpc: { team_members: team } });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Sam Staff' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }),
    );

    expect(fake.mocks.rpc).toHaveBeenCalledWith('remove_member', { p_user_id: 'u2' });
  });

  it('never offers to remove the owner', async () => {
    renderApp('/team', { ...as.owner, rpc: { team_members: team } });
    await screen.findByText('Olive Owner');
    expect(screen.queryByRole('button', { name: 'Remove Olive Owner' })).not.toBeInTheDocument();
  });

  it('staff can see the team but cannot invite or remove', async () => {
    renderApp('/team', {
      ...as.owner,
      membership: { ...ownerMembership, role: 'staff' },
      rpc: { team_members: team },
    });
    await screen.findByText('Sam Staff');
    expect(screen.queryByLabelText('Their email')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
  });
});

describe('security page', () => {
  const twoDevices = [
    { id: 'f1', factor_type: 'totp' as const, status: 'verified' as const, friendly_name: 'Phone' },
    {
      id: 'f2',
      factor_type: 'totp' as const,
      status: 'verified' as const,
      friendly_name: 'Tablet',
    },
  ];

  it('lists the authenticator devices on the account', async () => {
    renderApp('/account/security', { ...as.owner, factors: twoDevices });
    const list = await screen.findByRole('list', { name: 'Authenticator devices' });
    expect(await within(list).findByText('Phone')).toBeInTheDocument();
    expect(within(list).getByText('Tablet')).toBeInTheDocument();
  });

  it('recommends a backup when there is only one device, and does not allow removing it', async () => {
    renderApp('/account/security', as.owner);
    expect(await screen.findByText(/Add a backup authenticator/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Phone' })).not.toBeInTheDocument();
  });

  it('adds a backup authenticator', async () => {
    const { fake } = renderApp('/account/security', as.owner);
    await userEvent.click(await screen.findByRole('button', { name: 'Add backup authenticator' }));

    expect(
      await screen.findByRole('img', { name: 'QR code for your authenticator app' }),
    ).toBeInTheDocument();
    expect(fake.mocks.auth.mfa.enroll).toHaveBeenCalledWith({
      factorType: 'totp',
      friendlyName: 'Backup authenticator 2',
      issuer: 'ClientShield',
    });
  });

  it('removes a device when there is more than one', async () => {
    const { fake } = renderApp('/account/security', { ...as.owner, factors: twoDevices });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Tablet' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }),
    );

    expect(fake.mocks.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f2' });
  });

  it('links to changing the password', async () => {
    renderApp('/account/security', as.owner);
    expect(await screen.findByRole('link', { name: 'Change password' })).toHaveAttribute(
      'href',
      '/reset-password',
    );
  });
});
