import { createFakeSupabase, typeText, type FakeState } from '@cs/core/testing';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AdminApp } from '../AdminApp';

const moderator: Partial<FakeState> = {
  session: { user: { id: 'm1', email: 'mod@clientshield.test' } },
  currentLevel: 'aal2',
  nextLevel: 'aal2',
  factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' }],
  rpc: { my_platform_role: 'moderator' },
};
const admin: Partial<FakeState> = { ...moderator, rpc: { my_platform_role: 'admin' } };

const openFlag = {
  id: 'f1',
  business_id: 'b1',
  kind: 'many_unsaved_checks',
  detail: '40 checks in 24 hours for people not saved as customers',
  created_at: '2026-10-19T09:00:00Z',
  resolved_at: null,
  resolution_note: null,
};

const rules = [
  { category: 'chargeback', months: 60, updated_at: '2026-10-01T00:00:00Z' },
  { category: 'false_workmanship_complaint', months: 24, updated_at: '2026-10-01T00:00:00Z' },
];

function renderAt(
  hash: string,
  state: Partial<FakeState> = moderator,
  flags: Record<string, unknown>[] = [openFlag],
) {
  window.location.hash = hash;
  const fake = createFakeSupabase({
    ...state,
    tables: {
      abuse_flags: flags,
      businesses: [{ id: 'b1', name: 'Alpha Plumbing', verification_status: 'verified' }],
      retention_rules: rules,
    },
  });
  render(<AdminApp supabase={fake.client} />);
  return fake;
}

describe('abuse flags', () => {
  it('the dashboard counts open flags', async () => {
    const fake = renderAt('#/');
    const queue = await screen.findByRole('link', { name: /Abuse flags/ });
    await waitFor(() => expect(queue).toHaveTextContent('1 open'));
    expect(queue).toHaveAttribute('href', '#/abuse_flags');
    expect(fake.query.is).toHaveBeenCalledWith('resolved_at', null);
  });

  it('lists flags with the business and what was noticed', async () => {
    renderAt('#/abuse_flags');
    const table = await screen.findByRole('table');
    expect(await within(table).findByText('Checks of unsaved people')).toBeInTheDocument();
    expect(within(table).getByText(/40 checks in 24 hours/)).toBeInTheDocument();
    expect(await within(table).findByText('Alpha Plumbing')).toBeInTheDocument();
    expect(within(table).getByText('Open')).toBeInTheDocument();
  });

  it('explains what to look for', async () => {
    renderAt('#/abuse_flags/f1/show');
    expect(
      await screen.findByRole('heading', { name: 'Checks of unsaved people' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/searching for people rather than checking bookings/),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Alpha Plumbing/ })).toHaveAttribute(
      'href',
      '#/businesses/b1/show',
    );
  });

  it('needs a note to resolve a flag', async () => {
    const fake = renderAt('#/abuse_flags/f1/show');
    await userEvent.click(await screen.findByRole('button', { name: 'Resolve flag' }));
    expect(await screen.findByText(/Add a note explaining what you found/)).toBeInTheDocument();
    expect(fake.mocks.rpc).not.toHaveBeenCalledWith('resolve_abuse_flag', expect.anything());
  });

  it('resolves a flag with a note', async () => {
    const fake = renderAt('#/abuse_flags/f1/show');
    await typeText(await screen.findByLabelText('What you found'), 'Imported old bookings.');
    await userEvent.click(screen.getByRole('button', { name: 'Resolve flag' }));
    await waitFor(() =>
      expect(fake.mocks.rpc).toHaveBeenCalledWith('resolve_abuse_flag', {
        p_flag_id: 'f1',
        p_note: 'Imported old bookings.',
      }),
    );
  });

  it('shows how a resolved flag was handled', async () => {
    renderAt('#/abuse_flags/f1/show', moderator, [
      {
        ...openFlag,
        resolved_at: '2026-10-20T10:00:00Z',
        resolution_note: 'Imported old bookings.',
      },
    ]);
    expect(await screen.findByText('Imported old bookings.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolve flag' })).not.toBeInTheDocument();
  });

  it('explains when resolving fails', async () => {
    const fake = renderAt('#/abuse_flags/f1/show');
    fake.whenRpc('resolve_abuse_flag', {
      data: null,
      error: { code: '55000', message: 'This flag is already resolved' },
    });
    await typeText(await screen.findByLabelText('What you found'), 'Done');
    await userEvent.click(screen.getByRole('button', { name: 'Resolve flag' }));
    expect(await screen.findByText('This flag is already resolved')).toBeInTheDocument();
  });
});

describe('retention settings', () => {
  it('is in the menu', async () => {
    renderAt('#/');
    expect(await screen.findByRole('menuitem', { name: /Retention/ })).toHaveAttribute(
      'href',
      '#/retention',
    );
  });

  it('shows moderators the rules, read-only', async () => {
    renderAt('#/retention');
    const table = await screen.findByRole('table', { name: 'Retention rules' });
    expect(await within(table).findByText('Chargeback')).toBeInTheDocument();
    expect(within(table).getByText('60 months')).toBeInTheDocument();
    expect(screen.getByText(/Only admins can change/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
  });

  it('lets admins change a rule', async () => {
    const fake = renderAt('#/retention', admin);
    const field = await screen.findByRole('spinbutton', { name: 'Months for Chargeback' });
    await userEvent.clear(field);
    await userEvent.type(field, '48');
    await userEvent.click(screen.getByRole('button', { name: 'Save Chargeback' }));
    await waitFor(() =>
      expect(fake.mocks.rpc).toHaveBeenCalledWith('set_retention_months', {
        p_category: 'chargeback',
        p_months: 48,
      }),
    );
  });

  it('shows why a change was refused', async () => {
    const fake = renderAt('#/retention', admin);
    fake.whenRpc('set_retention_months', {
      data: null,
      error: { code: '22023', message: 'Keep records between 6 and 60 months' },
    });
    const field = await screen.findByRole('spinbutton', { name: 'Months for Chargeback' });
    await userEvent.clear(field);
    await userEvent.type(field, '99');
    await userEvent.click(screen.getByRole('button', { name: 'Save Chargeback' }));
    expect(await screen.findByText('Keep records between 6 and 60 months')).toBeInTheDocument();
  });
});
