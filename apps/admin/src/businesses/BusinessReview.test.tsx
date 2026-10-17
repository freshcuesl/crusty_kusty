import { createFakeSupabase, type FakeState, typeText } from '@cs/core/testing';
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

const alpha = {
  id: 'b1',
  name: 'Alpha Plumbing',
  verification_status: 'pending',
  phone: '+12065550100',
  address_line1: '1 Main St',
  address_line2: null,
  city: 'Seattle',
  state: 'WA',
  postal_code: '98101',
  submitted_at: '2026-10-16T12:00:00Z',
  review_note: null,
};

async function renderAt(hash: string, tables: Record<string, unknown[]>) {
  window.location.hash = hash;
  const fake = createFakeSupabase({ ...moderator, tables });
  render(<AdminApp supabase={fake.client} />);
  return fake;
}

afterEach(() => {
  window.location.hash = '';
  vi.restoreAllMocks();
});

describe('business verification queue', () => {
  it('lists businesses waiting for review', async () => {
    await renderAt('#/businesses', { businesses: [alpha] });
    expect(await screen.findByText('Alpha Plumbing')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Waiting for review')).toBeInTheDocument();
  });

  it('the dashboard shows how many are waiting', async () => {
    await renderAt('#/', { businesses: [alpha, { ...alpha, id: 'b2', name: 'Bravo' }] });
    const queue = await screen.findByRole('link', { name: /Business verifications/ });
    await waitFor(() => expect(queue).toHaveTextContent('2 waiting'));
  });
});

describe('reviewing a business', () => {
  const pdf = new Blob(['%PDF-1.7 license'], { type: 'application/pdf' });

  async function openReview(
    overrides: Partial<typeof alpha> = {},
    identity: unknown[] = [
      { id: 'i1', business_id: 'b1', status: 'verified', updated_at: '2026-10-16T10:00:00Z' },
    ],
  ) {
    const doc = {
      id: 'd1',
      business_id: 'b1',
      kind: 'business_license',
      file_name: 'license.pdf',
      storage_path: 'b1/abc.pdf',
      sha256: await sha256Hex(pdf),
      uploaded_at: '2026-10-16T11:00:00Z',
    };
    const fake = await renderAt('#/businesses/b1/show', {
      businesses: [{ ...alpha, ...overrides }],
      business_documents: [doc],
      owner_identity_checks: identity,
      verification_events: [
        {
          id: 1,
          business_id: 'b1',
          action: 'submitted',
          note: null,
          created_at: '2026-10-16T12:00:00Z',
        },
      ],
    });
    await screen.findByRole('heading', { name: 'Alpha Plumbing' });
    return { fake, doc };
  }

  it('shows the business details and documents', async () => {
    await openReview();
    expect(screen.getByText('(206) 555-0100')).toBeInTheDocument();
    expect(screen.getByText(/1 Main St/)).toBeInTheDocument();
    expect(await screen.findByText('license.pdf')).toBeInTheDocument();
    expect(screen.getByText('Business license')).toBeInTheDocument();
  });

  it('opens a document through a link that expires in 5 minutes', async () => {
    const { fake } = await openReview();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await userEvent.click(await screen.findByRole('button', { name: 'Open license.pdf' }));
    expect(fake.bucket.createSignedUrl).toHaveBeenCalledWith('b1/abc.pdf', 300);
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'https://storage.test/signed/b1/abc.pdf?token=t',
        '_blank',
        'noopener,noreferrer',
      ),
    );
  });

  it('confirms a document is unchanged since upload', async () => {
    const { fake } = await openReview();
    fake.bucket.download.mockResolvedValueOnce({ data: pdf, error: null } as never);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Check fingerprint of license.pdf' }),
    );
    expect(await screen.findByText('Unchanged since upload')).toBeInTheDocument();
  });

  it('warns when a document has been altered', async () => {
    const { fake } = await openReview();
    fake.bucket.download.mockResolvedValueOnce({
      data: new Blob(['edited']),
      error: null,
    } as never);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Check fingerprint of license.pdf' }),
    );
    expect(
      await screen.findByText('Does not match the upload. Do not approve.'),
    ).toBeInTheDocument();
  });

  it('approves a business', async () => {
    const { fake } = await openReview();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('review_business', {
      p_business_id: 'b1',
      p_decision: 'approve',
      p_note: null,
    });
  });

  it('requires a note before asking for more information', async () => {
    const { fake } = await openReview();
    await userEvent.click(screen.getByRole('button', { name: 'Ask for more info' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add a note explaining the decision',
    );
    expect(fake.mocks.rpc).not.toHaveBeenCalledWith('review_business', expect.anything());

    await typeText(screen.getByLabelText('Note to the business'), 'License is expired.');
    await userEvent.click(screen.getByRole('button', { name: 'Ask for more info' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('review_business', {
      p_business_id: 'b1',
      p_decision: 'needs_info',
      p_note: 'License is expired.',
    });
  });

  it('rejects with a note', async () => {
    const { fake } = await openReview();
    await typeText(screen.getByLabelText('Note to the business'), 'Not a real business.');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('review_business', {
      p_business_id: 'b1',
      p_decision: 'reject',
      p_note: 'Not a real business.',
    });
  });

  it('only offers decisions while the business is waiting for review', async () => {
    await openReview({ verification_status: 'verified' });
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('shows the history of the review', async () => {
    await openReview();
    const history = await screen.findByRole('list', { name: 'History' });
    expect(within(history).getByText('Submitted for review')).toBeInTheDocument();
  });
});

describe('owner identity on the review page', () => {
  it('shows that Stripe verified the owner', async () => {
    window.location.hash = '#/businesses/b1/show';
    const fake = createFakeSupabase({
      ...moderator,
      tables: {
        businesses: [alpha],
        owner_identity_checks: [
          { id: 'i1', business_id: 'b1', status: 'verified', updated_at: '2026-10-16T10:00:00Z' },
        ],
      },
    });
    render(<AdminApp supabase={fake.client} />);
    expect(await screen.findByText('Verified by Stripe')).toBeInTheDocument();
  });

  it('warns when the owner has not passed the identity check', async () => {
    window.location.hash = '#/businesses/b1/show';
    const fake = createFakeSupabase({
      ...moderator,
      tables: {
        businesses: [alpha],
        owner_identity_checks: [
          {
            id: 'i1',
            business_id: 'b1',
            status: 'requires_input',
            updated_at: '2026-10-16T10:00:00Z',
          },
        ],
      },
    });
    render(<AdminApp supabase={fake.client} />);
    expect(
      await screen.findByText('Not verified. Approval will be refused until it is.'),
    ).toBeInTheDocument();
  });
});
