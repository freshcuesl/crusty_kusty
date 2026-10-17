import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { as, ownerMembership, renderApp } from '../test/renderApp';

const redirectTo = vi.hoisted(() => vi.fn());
vi.mock('../verification/redirect', () => ({ redirectTo }));

beforeEach(() => {
  redirectTo.mockClear();
});

const free = {
  tier: 'free',
  plan_name: 'Free',
  monthly_checks: 10,
  max_members: 1,
  checks_used: 7,
  members: 1,
  status: 'none',
  billing_interval: null,
  current_period_end: null,
  cancel_at_period_end: false,
  trial_ends_at: '2026-10-01T00:00:00Z',
  has_billing_account: false,
  can_manage: true,
};

const trial = {
  ...free,
  tier: 'pro',
  plan_name: 'Pro',
  monthly_checks: null,
  max_members: 3,
  trial_ends_at: '2099-11-04T12:00:00Z',
};

const paid = {
  ...free,
  tier: 'team',
  plan_name: 'Team',
  monthly_checks: null,
  max_members: 15,
  status: 'active',
  billing_interval: 'year',
  current_period_end: '2099-10-21T12:00:00Z',
  trial_ends_at: null,
  has_billing_account: true,
};

function openBilling(subscription: Record<string, unknown>, state = as.verifiedOwner) {
  return renderApp('/billing', { ...state, rpc: { my_subscription: subscription } });
}

describe('plan and billing', () => {
  it('shows the Free plan and how many checks are left', async () => {
    openBilling(free);
    const current = await screen.findByRole('region', { name: 'Your plan' });
    expect(current).toHaveTextContent('Free');
    expect(current).toHaveTextContent('7 of 10 checks used this month');
    expect(current).toHaveTextContent('1 of 1 user');
  });

  it('shows how long the free trial lasts', async () => {
    openBilling(trial);
    const current = await screen.findByRole('region', { name: 'Your plan' });
    expect(current).toHaveTextContent('Pro free trial');
    expect(current).toHaveTextContent(/Trial ends/);
    expect(current).toHaveTextContent('Unlimited checks');
  });

  it('compares the plans with monthly and yearly prices', async () => {
    openBilling(free);
    const plans = await screen.findByRole('list', { name: 'Plans' });
    expect(within(plans).getByRole('listitem', { name: 'Pro' })).toHaveTextContent('$29');
    expect(within(plans).getByRole('listitem', { name: 'Team' })).toHaveTextContent('$59');
    await userEvent.click(screen.getByRole('button', { name: 'Yearly' }));
    expect(within(plans).getByRole('listitem', { name: 'Pro' })).toHaveTextContent('$290');
    expect(within(plans).getByRole('listitem', { name: 'Pro' })).toHaveTextContent('2 months free');
    expect(within(plans).getByRole('listitem', { name: 'Business' })).toHaveTextContent(
      'Contact us',
    );
  });

  it('sends the owner to Stripe Checkout for the chosen plan', async () => {
    const { fake } = openBilling(free);
    fake.mocks.functions.invoke.mockResolvedValueOnce({
      data: { url: 'https://checkout.stripe.com/c/abc' },
      error: null,
    } as never);
    await userEvent.click(await screen.findByRole('button', { name: 'Yearly' }));
    await userEvent.click(screen.getByRole('button', { name: 'Choose Team' }));
    expect(fake.mocks.functions.invoke).toHaveBeenCalledWith('create-checkout-session', {
      method: 'POST',
      body: { plan: 'team', interval: 'year' },
    });
    await waitFor(() =>
      expect(redirectTo).toHaveBeenCalledWith('https://checkout.stripe.com/c/abc'),
    );
  });

  it('explains that trial days are kept when subscribing during the trial', async () => {
    openBilling(trial);
    expect(await screen.findByText(/won't be charged until your trial ends/)).toBeInTheDocument();
  });

  it('shows the reason when checkout cannot open', async () => {
    const { fake } = openBilling(free);
    fake.mocks.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        context: new Response(JSON.stringify({ error: "Billing isn't set up yet." }), {
          status: 503,
        }),
      },
    } as never);
    await userEvent.click(await screen.findByRole('button', { name: 'Choose Pro' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Billing isn't set up yet.");
    expect(redirectTo).not.toHaveBeenCalled();
  });

  it('shows a paid plan with its renewal date and opens Manage billing', async () => {
    const { fake } = openBilling(paid);
    fake.mocks.functions.invoke.mockResolvedValueOnce({
      data: { url: 'https://billing.stripe.com/p/abc' },
      error: null,
    } as never);
    const current = await screen.findByRole('region', { name: 'Your plan' });
    expect(current).toHaveTextContent('Team');
    expect(current).toHaveTextContent('Billed yearly');
    expect(current).toHaveTextContent(/Renews/);
    expect(screen.queryByRole('button', { name: /Choose/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Manage billing' }));
    expect(fake.mocks.functions.invoke).toHaveBeenCalledWith('create-billing-portal', {
      method: 'POST',
    });
    await waitFor(() =>
      expect(redirectTo).toHaveBeenCalledWith('https://billing.stripe.com/p/abc'),
    );
  });

  it('says when a canceled plan ends', async () => {
    openBilling({ ...paid, cancel_at_period_end: true });
    const current = await screen.findByRole('region', { name: 'Your plan' });
    expect(current).toHaveTextContent(/Ends/);
    expect(current).not.toHaveTextContent(/Renews/);
  });

  it('warns when a payment failed', async () => {
    openBilling({ ...paid, status: 'past_due' });
    expect(await screen.findByText(/last payment didn't go through/)).toBeInTheDocument();
  });

  it('thanks the owner after checkout', async () => {
    renderApp('/billing?checkout=success', {
      ...as.verifiedOwner,
      rpc: { my_subscription: paid },
    });
    expect(await screen.findByText(/Thanks! Your plan is active/)).toBeInTheDocument();
  });

  it('shows staff the plan but only the owner can change it', async () => {
    openBilling(
      { ...free, can_manage: false },
      {
        ...as.verifiedOwner,
        membership: {
          role: 'staff',
          business: { ...ownerMembership.business, verification_status: 'verified' },
        },
      },
    );
    expect(
      await screen.findByText(/Only the business owner can change the plan/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Choose/ })).not.toBeInTheDocument();
  });

  it('is in the account menu', async () => {
    const { path } = renderApp('/', { ...as.verifiedOwner, rpc: { my_subscription: free } });
    await userEvent.click(await screen.findByRole('button', { name: /account/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Plan and billing' }));
    await waitFor(() => expect(path()).toBe('/billing'));
  });

  it('explains when billing cannot load', async () => {
    const { fake } = renderApp('/billing', as.verifiedOwner);
    fake.whenRpc('my_subscription', {
      data: null,
      error: { code: 'P0002', message: 'Business not found' },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Business not found');
  });
});

describe('plan reminders on the home screen', () => {
  it('shows the trial days left', async () => {
    renderApp('/', { ...as.verifiedOwner, rpc: { my_subscription: trial } });
    const link = await screen.findByRole('link', { name: /Pro free trial/ });
    expect(link).toHaveAttribute('href', '/billing');
  });

  it('warns when Free checks are running out', async () => {
    renderApp('/', {
      ...as.verifiedOwner,
      rpc: { my_subscription: { ...free, checks_used: 9 } },
    });
    expect(await screen.findByText(/1 free check left this month/)).toBeInTheDocument();
  });

  it('stays quiet on a paid plan', async () => {
    renderApp('/', { ...as.verifiedOwner, rpc: { my_subscription: paid } });
    await screen.findByRole('heading', { name: 'What do you need?' });
    expect(screen.queryByText(/free trial|free check/i)).not.toBeInTheDocument();
  });

  it('says when no free checks are left', async () => {
    renderApp('/', {
      ...as.verifiedOwner,
      rpc: { my_subscription: { ...free, checks_used: 10 } },
    });
    expect(await screen.findByText(/No free checks left this month/)).toBeInTheDocument();
  });

  it('counts down the last day of the trial', async () => {
    const tomorrow = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
    renderApp('/', {
      ...as.verifiedOwner,
      rpc: { my_subscription: { ...trial, trial_ends_at: tomorrow } },
    });
    expect(await screen.findByRole('link', { name: /1 day left/ })).toBeInTheDocument();
  });

  it('stays quiet while plenty of free checks are left', async () => {
    const { fake } = renderApp('/', {
      ...as.verifiedOwner,
      rpc: { my_subscription: { ...free, checks_used: 2 } },
    });
    await waitFor(() => expect(fake.mocks.rpc).toHaveBeenCalledWith('my_subscription'));
    expect(screen.queryByText(/free check/i)).not.toBeInTheDocument();
  });

  it('stays quiet when the plan cannot load', async () => {
    const { fake } = renderApp('/', as.verifiedOwner);
    // A dropped connection rejects the request, as the real client does.
    fake.whenRpc('my_subscription', () => Promise.reject(new TypeError('Failed to fetch')));
    await screen.findByRole('heading', { name: 'What do you need?' });
    expect(screen.queryByRole('link', { name: /trial/ })).not.toBeInTheDocument();
  });
});
