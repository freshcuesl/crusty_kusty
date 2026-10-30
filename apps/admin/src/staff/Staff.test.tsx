import { createFakeSupabase, typeText, type FakeState } from '@cs/core/testing';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AdminApp } from '../AdminApp';

const staff = [
  { user_id: 'a1', email: 'don@example.com', role: 'admin', granted_at: '2026-10-01T00:00:00Z' },
  {
    user_id: 'm1',
    email: 'mod@example.com',
    role: 'moderator',
    granted_at: '2026-10-10T00:00:00Z',
  },
];

const signedIn = (
  role: 'admin' | 'moderator',
  extra: Record<string, unknown> = {},
): Partial<FakeState> => ({
  session: { user: { id: role === 'admin' ? 'a1' : 'm1', email: `${role}@example.com` } },
  currentLevel: 'aal2',
  nextLevel: 'aal2',
  factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' }],
  rpc: { my_platform_role: role, staff_members: staff, ...extra },
});

function renderAt(hash: string, state: Partial<FakeState>) {
  window.location.hash = hash;
  const fake = createFakeSupabase(state);
  render(<AdminApp supabase={fake.client} />);
  return fake;
}

describe('staff', () => {
  it('is in the menu for admins', async () => {
    renderAt('#/', signedIn('admin'));
    expect(await screen.findByRole('menuitem', { name: /Staff/ })).toHaveAttribute(
      'href',
      '#/staff',
    );
  });

  it('is not in the menu for moderators', async () => {
    renderAt('#/', signedIn('moderator'));
    await screen.findByRole('menuitem', { name: /Retention/ });
    expect(screen.queryByRole('menuitem', { name: /Staff/ })).not.toBeInTheDocument();
  });

  it('lists staff with their roles', async () => {
    renderAt('#/staff', signedIn('admin'));
    const table = await screen.findByRole('table', { name: 'Staff' });
    expect(
      within(table).getByRole('row', { name: /mod@example.com Moderator/ }),
    ).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /don@example.com Admin/ })).toBeInTheDocument();
  });

  it('adds a moderator by email', async () => {
    const fake = renderAt('#/staff', signedIn('admin'));
    await typeText(await screen.findByLabelText('Their ClientShield email'), 'newmod@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add to staff' }));
    await waitFor(() =>
      expect(fake.mocks.rpc).toHaveBeenCalledWith('add_staff_member', {
        p_email: 'newmod@example.com',
        p_role: 'moderator',
      }),
    );
  });

  it('can add another admin', async () => {
    const fake = renderAt('#/staff', signedIn('admin'));
    await typeText(await screen.findByLabelText('Their ClientShield email'), 'boss@example.com');
    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }));
    await userEvent.click(await screen.findByRole('option', { name: /Admin/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to staff' }));
    await waitFor(() =>
      expect(fake.mocks.rpc).toHaveBeenCalledWith('add_staff_member', {
        p_email: 'boss@example.com',
        p_role: 'admin',
      }),
    );
  });

  it('explains when the person has no account yet', async () => {
    const fake = renderAt('#/staff', signedIn('admin'));
    fake.whenRpc('add_staff_member', {
      data: null,
      error: {
        code: 'P0002',
        message: 'No ClientShield account uses that email. Ask them to sign up first.',
      },
    });
    await typeText(await screen.findByLabelText('Their ClientShield email'), 'nobody@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add to staff' }));
    expect(await screen.findByText(/Ask them to sign up first/)).toBeInTheDocument();
  });

  it('removes someone after confirming, but never yourself', async () => {
    const fake = renderAt('#/staff', signedIn('admin'));
    const table = await screen.findByRole('table', { name: 'Staff' });
    expect(
      within(table).queryByRole('button', { name: 'Remove don@example.com' }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      await within(table).findByRole('button', { name: 'Remove mod@example.com' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Remove mod@example.com?' });
    expect(dialog).toHaveTextContent(/lose access to the admin panel/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(fake.mocks.rpc).toHaveBeenCalledWith('remove_staff_member', { p_user_id: 'm1' }),
    );
  });
});
