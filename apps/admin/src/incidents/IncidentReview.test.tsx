import { createFakeSupabase, typeText, type FakeState } from '@cs/core/testing';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '@cs/core';
import { AdminApp } from '../AdminApp';

const moderator: Partial<FakeState> = {
  session: { user: { id: 'm1', email: 'mod@clientshield.test' } },
  currentLevel: 'aal2',
  nextLevel: 'aal2',
  factors: [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone' }],
  rpc: { my_platform_role: 'moderator' },
};

const incident = {
  id: 'i1',
  business_id: 'b1',
  status: 'submitted',
  category: 'chargeback',
  service_date: '2026-10-01',
  service_type: 'Carpet cleaning',
  invoice_number: 'INV-1001',
  description: 'Customer filed a chargeback after signing the completed work order.',
  review_url: 'https://g.page/r/abc/review',
  review_rating: 1,
  review_date: '2026-10-03',
  review_text: 'Terrible!',
  submitted_at: '2026-10-04T09:00:00Z',
};

const pdf = new Blob(['%PDF signed work order'], { type: 'application/pdf' });

async function renderAt(hash: string, overrides: Record<string, unknown[]> = {}) {
  window.location.hash = hash;
  const fake = createFakeSupabase({
    ...moderator,
    tables: {
      incidents: [incident],
      businesses: [{ id: 'b1', name: 'Alpha Plumbing', verification_status: 'verified' }],
      incident_customers: [
        {
          id: 'i1',
          incident_id: 'i1',
          full_name: 'John Smith',
          phone: '+12065550100',
          email: 'john@example.com',
          address_line1: '123 Main St',
          city: 'Seattle',
          state: 'WA',
          postal_code: '98101',
        },
      ],
      incident_evidence: [
        {
          id: 'e1',
          incident_id: 'i1',
          kind: 'work_authorization',
          file_name: 'work-order.pdf',
          storage_path: 'b1/i1/abc.pdf',
          sha256: await sha256Hex(pdf),
          uploaded_at: '2026-10-04T08:00:00Z',
        },
      ],
      incident_events: [
        {
          id: 1,
          incident_id: 'i1',
          action: 'submitted',
          note: null,
          created_at: '2026-10-04T09:00:00Z',
        },
      ],
      ...overrides,
    },
  });
  render(<AdminApp supabase={fake.client} />);
  return fake;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('incident review queue', () => {
  it('lists incidents waiting for review', async () => {
    await renderAt('#/incidents');
    const table = await screen.findByRole('table');
    expect(await within(table).findByText('Chargeback')).toBeInTheDocument();
    expect(within(table).getByText('Waiting for review')).toBeInTheDocument();
  });

  it('the dashboard shows how many are waiting', async () => {
    await renderAt('#/');
    const queue = await screen.findByRole('link', { name: /Incident review/ });
    await waitFor(() => expect(queue).toHaveTextContent('1 waiting'));
    expect(queue).toHaveAttribute('href', '#/incidents');
  });
});

describe('reviewing an incident', () => {
  async function open(overrides: Record<string, unknown[]> = {}) {
    const fake = await renderAt('#/incidents/i1/show', overrides);
    await screen.findByRole('heading', { name: 'Chargeback' });
    return fake;
  }

  it('shows who reported it, the customer and the dispute', async () => {
    await open();
    expect(await screen.findByText(/Reported by Alpha Plumbing/)).toBeInTheDocument();
    expect(await screen.findByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText(/Customer filed a chargeback/)).toBeInTheDocument();
  });

  it('links to the Google review for checking', async () => {
    await open();
    expect(await screen.findByRole('link', { name: /Open the Google review/ })).toHaveAttribute(
      'href',
      'https://g.page/r/abc/review',
    );
  });

  it('opens evidence through a short-lived link', async () => {
    const fake = await open();
    const popup = vi.spyOn(window, 'open').mockReturnValue(null);
    await userEvent.click(await screen.findByRole('button', { name: 'Open work-order.pdf' }));
    expect(fake.mocks.storage.from).toHaveBeenCalledWith('incident-evidence');
    expect(fake.bucket.createSignedUrl).toHaveBeenCalledWith('b1/i1/abc.pdf', 300);
    await waitFor(() => expect(popup).toHaveBeenCalled());
  });

  it('confirms evidence is unchanged since upload', async () => {
    const fake = await open();
    fake.bucket.download.mockResolvedValueOnce({ data: pdf, error: null } as never);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Check fingerprint of work-order.pdf' }),
    );
    expect(await screen.findByText('Unchanged since upload')).toBeInTheDocument();
  });

  it('verifies the evidence', async () => {
    const fake = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Verify evidence' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('review_incident', {
      p_incident_id: 'i1',
      p_decision: 'verify',
      p_note: null,
    });
  });

  it('requires a note to ask for more information', async () => {
    const fake = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Ask for more info' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a note');
    await typeText(screen.getByLabelText('Note to the reporter'), 'Add the signed work order.');
    await userEvent.click(screen.getByRole('button', { name: 'Ask for more info' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('review_incident', {
      p_incident_id: 'i1',
      p_decision: 'needs_info',
      p_note: 'Add the signed work order.',
    });
  });

  it('rejects with a note', async () => {
    const fake = await open();
    await typeText(
      screen.getByLabelText('Note to the reporter'),
      'The invoice is for another job.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('review_incident', {
      p_incident_id: 'i1',
      p_decision: 'reject',
      p_note: 'The invoice is for another job.',
    });
  });

  it('only offers decisions while the incident is waiting', async () => {
    await open({ incidents: [{ ...incident, status: 'evidence_verified' }] });
    expect(screen.queryByRole('button', { name: 'Verify evidence' })).not.toBeInTheDocument();
    expect(screen.getByText('Evidence verified')).toBeInTheDocument();
  });

  it('shows the history', async () => {
    await open();
    const history = await screen.findByRole('list', { name: 'History' });
    expect(await within(history).findByText('Submitted for review')).toBeInTheDocument();
  });
});
