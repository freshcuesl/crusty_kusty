import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FakeState } from '@cs/core/testing';
import { describe, expect, it } from 'vitest';
import { as, renderApp } from '../test/renderApp';

const pro = {
  tier: 'pro',
  plan_name: 'Pro',
  monthly_checks: null,
  max_members: 3,
  checks_used: 4,
  members: 1,
  status: 'active',
  billing_interval: 'month',
  current_period_end: '2099-01-01T00:00:00Z',
  cancel_at_period_end: false,
  trial_ends_at: null,
  has_billing_account: true,
  can_manage: true,
};

const withPlan = (subscription: unknown, extra: Partial<FakeState> = {}): Partial<FakeState> => ({
  ...as.verifiedOwner,
  ...extra,
  rpc: { my_subscription: subscription, ...extra.rpc },
});

async function openMiles() {
  await userEvent.click(await screen.findByRole('button', { name: 'Ask Miles' }));
  return screen.findByRole('dialog', { name: /Miles/ });
}

describe('Ask Miles', () => {
  it('is on every app page and opens Miles for help', async () => {
    renderApp('/', withPlan(pro));
    const dialog = await openMiles();
    expect(dialog).toHaveTextContent('Help and how-to');
    expect(
      within(dialog).getByRole('button', { name: 'How do customer checks work?' }),
    ).toBeInTheDocument();
  });

  it('sends the conversation to Miles and shows the reply', async () => {
    const { fake } = renderApp('/', withPlan(pro));
    fake.mocks.functions.invoke.mockResolvedValueOnce({
      data: { reply: 'A check compares at least two details with verified incidents.' },
      error: null,
    } as never);
    const dialog = await openMiles();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'How do customer checks work?' }),
    );

    expect(fake.mocks.functions.invoke).toHaveBeenCalledWith('miles', {
      method: 'POST',
      body: {
        mode: 'help',
        messages: [{ role: 'user', content: 'How do customer checks work?' }],
      },
    });
    const log = within(dialog).getByRole('log');
    expect(await within(log).findByText(/compares at least two details/)).toBeInTheDocument();
    expect(within(log).getByText('How do customer checks work?')).toBeInTheDocument();
  });

  it('keeps the whole conversation for follow-up questions', async () => {
    const { fake } = renderApp('/', withPlan(pro));
    fake.mocks.functions.invoke
      .mockResolvedValueOnce({ data: { reply: 'First answer.' }, error: null } as never)
      .mockResolvedValueOnce({ data: { reply: 'Second answer.' }, error: null } as never);
    const dialog = await openMiles();
    const box = within(dialog).getByRole('textbox', { name: 'Message Miles' });
    await userEvent.type(box, 'First question{Enter}');
    await within(dialog).findByText('First answer.');
    await userEvent.type(box, 'Follow-up{Enter}');
    await within(dialog).findByText('Second answer.');
    expect(fake.mocks.functions.invoke).toHaveBeenLastCalledWith('miles', {
      method: 'POST',
      body: {
        mode: 'help',
        messages: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer.' },
          { role: 'user', content: 'Follow-up' },
        ],
      },
    });
  });

  it('explains when Miles cannot answer', async () => {
    const { fake } = renderApp('/', withPlan(pro));
    fake.mocks.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        context: new Response(
          JSON.stringify({
            error: 'Miles has answered 40 messages for you today. Try again tomorrow.',
          }),
          { status: 429 },
        ),
      },
    } as never);
    const dialog = await openMiles();
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Message Miles' }),
      'Hi{Enter}',
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('40 messages');
  });

  it('invites Free businesses to upgrade instead', async () => {
    renderApp('/', withPlan({ ...pro, tier: 'free', plan_name: 'Free', status: 'none' }));
    const dialog = await openMiles();
    expect(
      within(dialog).queryByRole('textbox', { name: 'Message Miles' }),
    ).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent(/included in Pro and Team/);
    expect(within(dialog).getByRole('link', { name: 'See plans' })).toHaveAttribute(
      'href',
      '/billing',
    );
  });

  it('coaches an incident report from its page', async () => {
    const { fake } = renderApp(
      '/incidents/i1',
      withPlan(pro, {
        tables: {
          incidents: [
            {
              id: 'i1',
              business_id: 'b1',
              status: 'draft',
              category: 'chargeback',
              service_date: '2026-10-01',
              service_type: 'Carpet cleaning',
              invoice_number: null,
              description: 'Customer filed a chargeback after signing the completed work order.',
              review_url: null,
              review_rating: null,
              review_date: null,
              review_text: null,
              review_note: null,
              expires_at: null,
              created_at: '2026-10-02T10:00:00Z',
            },
          ],
        },
      }),
    );
    fake.mocks.functions.invoke.mockResolvedValueOnce({
      data: { reply: 'Add the signed work order.' },
      error: null,
    } as never);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Review my report with Miles' }),
    );
    const dialog = await screen.findByRole('dialog', { name: /Miles/ });
    expect(dialog).toHaveTextContent('Report coach');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Review my report' }));
    await waitFor(() =>
      expect(fake.mocks.functions.invoke).toHaveBeenCalledWith('miles', {
        method: 'POST',
        body: {
          mode: 'report_coach',
          incidentId: 'i1',
          messages: [{ role: 'user', content: 'Review my report' }],
        },
      }),
    );
  });

  it('advises on an alert', async () => {
    const { fake } = renderApp(
      '/alerts/a1',
      withPlan(pro, {
        rpc: {
          alert_details: {
            alert_id: 'a1',
            customer_label: 'John Smith',
            decision: null,
            incident_count: 1,
            incidents: [
              {
                category: 'chargeback',
                service_month: '2026-03',
                evidence_count: 1,
                evidence_kinds: ['invoice'],
                review_rating: null,
                outcome: 'evidence_verified',
                customer_response: null,
                expires_month: '2031-03',
              },
            ],
          },
        },
      }),
    );
    fake.mocks.functions.invoke.mockResolvedValueOnce({
      data: { reply: 'Consider a deposit.' },
      error: null,
    } as never);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ask Miles about this alert' }),
    );
    const dialog = await screen.findByRole('dialog', { name: /Miles/ });
    expect(dialog).toHaveTextContent('Alert advisor');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'How can I protect this job?' }),
    );
    await waitFor(() =>
      expect(fake.mocks.functions.invoke).toHaveBeenCalledWith('miles', {
        method: 'POST',
        body: {
          mode: 'alert_advisor',
          alertId: 'a1',
          messages: [{ role: 'user', content: 'How can I protect this job?' }],
        },
      }),
    );
  });

  it('keeps the conversation when Miles is reopened for the same job', async () => {
    const { fake } = renderApp('/', withPlan(pro));
    fake.mocks.functions.invoke.mockResolvedValueOnce({
      data: { reply: 'Hello!' },
      error: null,
    } as never);
    const dialog = await openMiles();
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Message Miles' }),
      'Hi{Enter}',
    );
    await within(dialog).findByText('Hello!');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close Miles' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const again = await openMiles();
    expect(within(again).getByText('Hello!')).toBeInTheDocument();
  });
});
