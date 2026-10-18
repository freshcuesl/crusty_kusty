import { createFakeSupabase, type FakeState } from '@cs/core/testing';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminApp } from './AdminApp';

const week = (i: number) => ({
  week: `2026-09-${String(1 + i * 7).padStart(2, '0')}`,
  signups: i + 1,
  verified: i,
  checks: 10 * (i + 1),
  alerts: i % 2,
  incidents_submitted: 2,
  incidents_verified: 1,
});

const insights = {
  totals: {
    businesses: 42,
    verified_businesses: 30,
    users: 61,
    active_incidents: 12,
    checks_30d: 480,
    alerts_30d: 9,
  },
  weekly: Array.from({ length: 8 }, (_, i) => week(i)),
  decisions: { continue_booking: 0, require_authorization: 0, decline_job: 0, undecided: 0 },
  moderation: {
    businesses_waiting: 2,
    incidents_waiting: 5,
    open_flags: 1,
    median_incident_review_hours: 6,
    oldest_incident_waiting_hours: 30,
  },
  finances: null,
};

function renderDashboard(rpc: Record<string, unknown>) {
  window.location.hash = '#/';
  const state: Partial<FakeState> = {
    session: { user: { id: 'm1', email: 'mod@clientshield.test' } },
    currentLevel: 'aal2',
    nextLevel: 'aal2',
    factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' }],
    rpc: { my_platform_role: 'moderator', ...rpc },
  };
  const fake = createFakeSupabase(state);
  render(<AdminApp supabase={fake.client} />);
  return fake;
}

describe('dashboard overview', () => {
  it('shows quick numbers with an 8-week trend', async () => {
    const fake = renderDashboard({ admin_insights: insights });
    const overview = await screen.findByRole('region', { name: 'Overview' });
    expect(fake.mocks.rpc).toHaveBeenCalledWith('admin_insights', { p_weeks: 8 });

    const businesses = within(overview).getByRole('group', { name: /Businesses/ });
    expect(businesses).toHaveTextContent('42');
    expect(businesses).toHaveTextContent('30 verified');
    expect(within(overview).getByRole('group', { name: /Checks/ })).toHaveTextContent('480');
    expect(within(overview).getByRole('group', { name: /Alerts/ })).toHaveTextContent('9');
    expect(within(overview).getByRole('group', { name: /Active incidents/ })).toHaveTextContent(
      '12',
    );
    expect(within(overview).getAllByRole('img', { name: /last 8 weeks/ })).toHaveLength(4);
  });

  it('links to the full Insights page', async () => {
    renderDashboard({ admin_insights: insights });
    const overview = await screen.findByRole('region', { name: 'Overview' });
    expect(within(overview).getByRole('link', { name: /All insights/ })).toHaveAttribute(
      'href',
      '#/insights',
    );
  });

  it('keeps the review queues even when the numbers cannot load', async () => {
    renderDashboard({});
    expect(await screen.findByRole('heading', { name: 'Incident review' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Overview' })).not.toBeInTheDocument();
  });
});
