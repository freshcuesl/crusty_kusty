import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { typeText } from '@cs/core/testing';
import { describe, expect, it } from 'vitest';
import { as, renderApp } from '../test/renderApp';

const matchResult = {
  check_id: 'c1',
  alert_id: 'a1',
  incident_count: 1,
  incidents: [
    {
      category: 'chargeback',
      service_month: '2026-03',
      evidence_count: 2,
      evidence_kinds: ['invoice', 'before_after_photo'],
      review_rating: 1,
      outcome: 'evidence_verified',
      customer_response: null,
      expires_month: '2031-03',
    },
  ],
};

const clearResult = { check_id: 'c2', alert_id: null, incident_count: 0, incidents: [] };

async function fillCustomer() {
  await typeText(await screen.findByLabelText('Customer name'), 'John Smith');
  await typeText(screen.getByLabelText('Customer phone'), '(206) 555-0100');
  await typeText(screen.getByLabelText('Customer email'), 'john@example.com');
  await typeText(screen.getByLabelText('Street address'), '123 Main St');
  await typeText(screen.getByLabelText('ZIP code'), '98101');
}

describe('new customer', () => {
  it('saves the customer and checks them in one step', async () => {
    const { fake } = renderApp('/customers/new', as.verifiedOwner);
    fake.whenRpc('add_customer', { data: { ...clearResult, customer_id: 'cu1' }, error: null });

    await fillCustomer();
    await userEvent.click(screen.getByRole('button', { name: 'Add and check customer' }));

    expect(fake.mocks.rpc).toHaveBeenCalledWith('add_customer', {
      p_customer: {
        full_name: 'John Smith',
        phone: '+12065550100',
        email: 'john@example.com',
        address_line1: '123 Main St',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '98101',
      },
    });
    expect(await screen.findByText(/No verified incidents found/)).toBeInTheDocument();
  });

  it('shows a factual alert when the customer matches', async () => {
    const { fake } = renderApp('/customers/new', as.verifiedOwner);
    fake.whenRpc('add_customer', { data: { ...matchResult, customer_id: 'cu1' }, error: null });

    await fillCustomer();
    await userEvent.click(screen.getByRole('button', { name: 'Add and check customer' }));

    const alert = await screen.findByRole('region', { name: 'Verified incident found' });
    expect(alert).toHaveTextContent('1 verified incident');
    const card = within(alert).getByRole('article', { name: 'Incident from March 2026' });
    expect(card).toHaveTextContent('Chargeback');
    expect(card).toHaveTextContent('Verified business');
    expect(card).toHaveTextContent('1-star Google review');
    expect(card).toHaveTextContent('2 items: Invoice, Before and after photos');
    expect(card).toHaveTextContent('Customer response: none yet');
  });

  it('never tells the business not to serve the customer', async () => {
    const { fake } = renderApp('/customers/new', as.verifiedOwner);
    fake.whenRpc('add_customer', { data: { ...matchResult, customer_id: 'cu1' }, error: null });
    await fillCustomer();
    await userEvent.click(screen.getByRole('button', { name: 'Add and check customer' }));
    const alert = await screen.findByRole('region', { name: 'Verified incident found' });
    expect(alert.textContent).not.toMatch(/do not (service|serve)|bad customer|blacklist/i);
    expect(alert).toHaveTextContent('You decide how to proceed.');
  });

  it('records what the business decides', async () => {
    const { fake } = renderApp('/customers/new', as.verifiedOwner);
    fake.whenRpc('add_customer', { data: { ...matchResult, customer_id: 'cu1' }, error: null });
    await fillCustomer();
    await userEvent.click(screen.getByRole('button', { name: 'Add and check customer' }));

    await userEvent.click(
      await screen.findByRole('button', { name: 'Require additional authorization' }),
    );

    expect(fake.mocks.rpc).toHaveBeenCalledWith('respond_to_alert', {
      p_alert_id: 'a1',
      p_decision: 'require_authorization',
    });
    expect(
      await screen.findByText(/Decision saved: Require additional authorization/),
    ).toBeInTheDocument();
  });

  it('explains why a check was refused', async () => {
    const { fake } = renderApp('/customers/new', as.verifiedOwner);
    fake.whenRpc('add_customer', {
      data: null,
      error: { code: '22023', message: 'Enter at least a phone, email or address' },
    });
    await typeText(await screen.findByLabelText('Customer name'), 'John Smith');
    await userEvent.click(screen.getByRole('button', { name: 'Add and check customer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter at least a phone, email or address',
    );
  });

  it('checks the phone number format before sending', async () => {
    const { fake } = renderApp('/customers/new', as.verifiedOwner);
    await typeText(await screen.findByLabelText('Customer name'), 'John Smith');
    await typeText(screen.getByLabelText('Customer phone'), '555-0100');
    await userEvent.click(screen.getByRole('button', { name: 'Add and check customer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('10-digit US phone number');
    expect(fake.mocks.rpc).not.toHaveBeenCalledWith('add_customer', expect.anything());
  });
});

describe('customer check', () => {
  it('checks without saving the customer', async () => {
    const { fake } = renderApp('/check', as.verifiedOwner);
    fake.whenRpc('check_customer', { data: clearResult, error: null });
    await fillCustomer();
    await userEvent.click(screen.getByRole('button', { name: 'Check customer' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith(
      'check_customer',
      expect.objectContaining({
        p_customer: expect.objectContaining({ phone: '+12065550100' }),
      }),
    );
    expect(fake.mocks.rpc).not.toHaveBeenCalledWith('add_customer', expect.anything());
    expect(await screen.findByText(/No verified incidents found/)).toBeInTheDocument();
  });

  it('explains there is no searching for people', async () => {
    renderApp('/check', as.verifiedOwner);
    expect(await screen.findByText(/only for customers you already have/)).toBeInTheDocument();
  });

  it('can start a fresh check after a result', async () => {
    const { fake } = renderApp('/check', as.verifiedOwner);
    fake.whenRpc('check_customer', { data: clearResult, error: null });
    await fillCustomer();
    await userEvent.click(screen.getByRole('button', { name: 'Check customer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Check another customer' }));
    expect(await screen.findByLabelText('Customer name')).toHaveValue('');
  });
});

describe('alerts', () => {
  it('lists past alerts', async () => {
    renderApp('/alerts', {
      ...as.verifiedOwner,
      tables: {
        match_alerts: [
          {
            id: 'a1',
            customer_label: 'John Smith',
            incident_count: 2,
            decision: null,
            created_at: '2026-10-19T12:00:00Z',
          },
        ],
      },
    });
    const list = await screen.findByRole('list', { name: 'Alerts' });
    const link = await within(list).findByRole('link', { name: /John Smith/ });
    expect(link).toHaveAttribute('href', '/alerts/a1');
    expect(link).toHaveTextContent('2 verified incidents');
    expect(link).toHaveTextContent('No decision yet');
  });

  it('says when there are no alerts', async () => {
    renderApp('/alerts', as.verifiedOwner);
    expect(await screen.findByText(/No alerts yet/)).toBeInTheDocument();
  });

  it('opens an alert with its incident cards and the decision taken', async () => {
    renderApp('/alerts/a1', {
      ...as.verifiedOwner,
      rpc: {
        alert_details: {
          ...matchResult,
          customer_label: 'John Smith',
          decision: 'continue_booking',
          created_at: '2026-10-19T12:00:00Z',
        },
      },
    });
    expect(
      await screen.findByRole('heading', { name: 'Alert for John Smith' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Incident from March 2026' })).toBeInTheDocument();
    expect(screen.getByText(/Decision saved: Continue booking/)).toBeInTheDocument();
  });

  it('home shows alerts as a working link for verified businesses', async () => {
    const { path } = renderApp('/', as.verifiedOwner);
    await userEvent.click(await screen.findByRole('link', { name: /Alerts/ }));
    await waitFor(() => expect(path()).toBe('/alerts'));
  });
});

describe('matching edge cases', () => {
  const twoIncidents = {
    ...matchResult,
    incident_count: 2,
    incidents: [
      matchResult.incidents[0],
      {
        category: 'refund_after_completed_service',
        service_month: '2025-11',
        evidence_count: 1,
        evidence_kinds: ['invoice'],
        review_rating: null,
        outcome: 'evidence_verified',
        customer_response: null,
        expires_month: null,
      },
    ],
  };

  it('shows every matching incident, and only shows a review when there was one', async () => {
    const { fake } = renderApp('/check', as.verifiedOwner);
    fake.whenRpc('check_customer', { data: twoIncidents, error: null });
    await fillCustomer();
    await userEvent.click(screen.getByRole('button', { name: 'Check customer' }));
    const alert = await screen.findByRole('region', { name: 'Verified incident found' });
    expect(alert).toHaveTextContent('2 verified incidents');
    const second = within(alert).getByRole('article', { name: 'Incident from November 2025' });
    expect(second).toHaveTextContent('1 item: Invoice');
    expect(second).not.toHaveTextContent('Google review');
  });

  it('records a declined job', async () => {
    const { fake } = renderApp('/check', as.verifiedOwner);
    fake.whenRpc('check_customer', { data: matchResult, error: null });
    await fillCustomer();
    await userEvent.click(screen.getByRole('button', { name: 'Check customer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Decline job' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('respond_to_alert', {
      p_alert_id: 'a1',
      p_decision: 'decline_job',
    });
  });

  it('explains when a decision cannot be saved', async () => {
    const { fake } = renderApp('/check', as.verifiedOwner);
    fake.whenRpc('check_customer', { data: matchResult, error: null });
    fake.whenRpc('respond_to_alert', {
      data: null,
      error: { code: 'P0002', message: 'Alert not found' },
    });
    await fillCustomer();
    await userEvent.click(screen.getByRole('button', { name: 'Check customer' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Continue booking' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Alert not found');
  });

  it('explains a lost connection during a check', async () => {
    const { fake } = renderApp('/check', as.verifiedOwner);
    fake.whenRpc('check_customer', () => {
      throw new TypeError('Failed to fetch');
    });
    await fillCustomer();
    await userEvent.click(screen.getByRole('button', { name: 'Check customer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server");
  });

  it('explains an alert that cannot be opened', async () => {
    const { fake } = renderApp('/alerts/nope', as.verifiedOwner);
    fake.whenRpc('alert_details', {
      data: null,
      error: { code: 'P0002', message: 'Alert not found' },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Alert not found');
  });
});
