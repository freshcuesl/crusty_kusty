import { createFakeSupabase, type FakeState } from '@cs/core/testing';
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

const weekly = Array.from({ length: 12 }, (_, i) => ({
  week: `2026-${String(8 + Math.floor(i / 4)).padStart(2, '0')}-${String(1 + (i % 4) * 7).padStart(2, '0')}`,
  signups: i,
  verified: Math.floor(i / 2),
  checks: i * 10,
  alerts: i % 3,
  incidents_submitted: 2,
  incidents_verified: 1,
}));

const insights = {
  generated_at: '2026-10-21T12:00:00Z',
  totals: {
    businesses: 42,
    verified_businesses: 30,
    users: 61,
    active_incidents: 12,
    checks_30d: 480,
    alerts_30d: 9,
  },
  weekly,
  decisions: { continue_booking: 4, require_authorization: 3, decline_job: 1, undecided: 1 },
  moderation: {
    businesses_waiting: 2,
    incidents_waiting: 5,
    open_flags: 1,
    median_incident_review_hours: 6.5,
    oldest_incident_waiting_hours: 30.2,
  },
  finances: null,
};

const finances = {
  paying: 9,
  mrr_cents: 31_017,
  arr_cents: 372_204,
  stripe_trialing: 2,
  trials_ending_7d: 3,
  past_due: 1,
  canceling: 1,
  trial_conversion: { ended: 10, converted: 4 },
  plan_mix: { free: 20, pro: 7, team: 2, business: 0 },
};

function renderInsights(state: Partial<FakeState>, data: unknown) {
  window.location.hash = '#/insights';
  const fake = createFakeSupabase({ ...state, rpc: { ...state.rpc, admin_insights: data } });
  render(<AdminApp supabase={fake.client} />);
  return fake;
}

describe('insights', () => {
  it('is in the menu', async () => {
    renderInsights(moderator, insights);
    expect(await screen.findByRole('menuitem', { name: /Insights/ })).toHaveAttribute(
      'href',
      '#/insights',
    );
  });

  it('leads with the headline numbers', async () => {
    renderInsights(moderator, insights);
    const totals = await screen.findByRole('region', { name: 'At a glance' });
    expect(within(totals).getByText('42')).toBeInTheDocument();
    expect(within(totals).getByText('Businesses')).toBeInTheDocument();
    expect(within(totals).getByText('480')).toBeInTheDocument();
    expect(within(totals).getByText('Checks, last 30 days')).toBeInTheDocument();
  });

  it('shows the weekly trends as charts with a table view', async () => {
    const fake = renderInsights(moderator, insights);
    await screen.findByRole('region', { name: 'Weekly trends' });
    expect(fake.mocks.rpc).toHaveBeenCalledWith('admin_insights', { p_weeks: 12 });
    expect(screen.getByRole('figure', { name: /Customer checks per week/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show as table' }));
    const table = screen.getByRole('table', { name: 'Weekly trends' });
    expect(within(table).getAllByRole('row')).toHaveLength(13);
    expect(within(table).getByRole('columnheader', { name: 'Checks' })).toBeInTheDocument();
  });

  it('can look further back', async () => {
    const fake = renderInsights(moderator, insights);
    await screen.findByRole('region', { name: 'Weekly trends' });
    await userEvent.click(screen.getByRole('button', { name: '26 weeks' }));
    await waitFor(() =>
      expect(fake.mocks.rpc).toHaveBeenCalledWith('admin_insights', { p_weeks: 26 }),
    );
  });

  it('shows what businesses decided after alerts', async () => {
    renderInsights(moderator, insights);
    const decisions = await screen.findByRole('region', { name: 'After an alert' });
    expect(decisions).toHaveTextContent('Continue booking');
    expect(decisions).toHaveTextContent('4');
    expect(decisions).toHaveTextContent('Decline job');
  });

  it('shows the moderation workload', async () => {
    renderInsights(moderator, insights);
    const moderation = await screen.findByRole('region', { name: 'Moderation' });
    expect(moderation).toHaveTextContent('5');
    expect(moderation).toHaveTextContent('Incidents waiting');
    expect(moderation).toHaveTextContent('6.5 h');
    expect(moderation).toHaveTextContent('30.2 h');
  });

  it('hides finances from moderators', async () => {
    renderInsights(moderator, insights);
    await screen.findByRole('region', { name: 'At a glance' });
    expect(screen.queryByRole('region', { name: 'Finances' })).not.toBeInTheDocument();
  });

  it('shows admins revenue, plans and billing problems', async () => {
    renderInsights({ ...moderator, rpc: { my_platform_role: 'admin' } }, { ...insights, finances });
    const money = await screen.findByRole('region', { name: 'Finances' });
    expect(money).toHaveTextContent('$310.17');
    expect(money).toHaveTextContent('Monthly recurring revenue');
    expect(money).toHaveTextContent('$3,722.04');
    expect(money).toHaveTextContent('40%');
    expect(money).toHaveTextContent('4 of 10 trials became paid plans');
    expect(within(money).getByRole('link', { name: /Open Stripe/ })).toHaveAttribute(
      'href',
      'https://dashboard.stripe.com/',
    );
    const mix = within(money).getByRole('table', { name: 'Businesses by plan' });
    expect(within(mix).getByRole('row', { name: /Pro 7/ })).toBeInTheDocument();
  });

  it('explains when insights cannot load', async () => {
    window.location.hash = '#/insights';
    const fake = createFakeSupabase(moderator);
    fake.whenRpc('admin_insights', {
      data: null,
      error: { code: '42501', message: 'Only ClientShield staff can see insights' },
    });
    render(<AdminApp supabase={fake.client} />);
    expect(await screen.findByText('Only ClientShield staff can see insights')).toBeInTheDocument();
  });

  it('shows a dash where there is nothing to measure yet', async () => {
    renderInsights(
      { ...moderator, rpc: { my_platform_role: 'admin' } },
      {
        ...insights,
        weekly: [],
        moderation: {
          ...insights.moderation,
          median_incident_review_hours: null,
          oldest_incident_waiting_hours: null,
        },
        finances: { ...finances, trial_conversion: { ended: 0, converted: 0 } },
      },
    );
    const moderation = await screen.findByRole('region', { name: 'Moderation' });
    expect(moderation).toHaveTextContent('Oldest waiting: –');
    const money = screen.getByRole('region', { name: 'Finances' });
    expect(money).toHaveTextContent('0 of 0 trials became paid plans');
    expect(within(money).getAllByText('–').length).toBeGreaterThan(0);
  });

  it('switches back from the table to the charts', async () => {
    renderInsights(moderator, insights);
    await userEvent.click(await screen.findByRole('button', { name: 'Show as table' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show as charts' }));
    expect(screen.getByRole('figure', { name: /Alerts per week/ })).toBeInTheDocument();
  });

  it('explains a lost connection', async () => {
    window.location.hash = '#/insights';
    const fake = createFakeSupabase(moderator);
    fake.whenRpc('admin_insights', () => Promise.reject(new TypeError('Failed to fetch')));
    render(<AdminApp supabase={fake.client} />);
    expect(await screen.findByText(/Can't reach the server/)).toBeInTheDocument();
  });
});
