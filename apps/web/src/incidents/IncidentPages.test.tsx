import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { typeText, type FakeState } from '@cs/core/testing';
import { describe, expect, it } from 'vitest';
import { as, renderApp } from '../test/renderApp';

const incident: Record<string, unknown> = {
  id: 'i1',
  business_id: 'b1',
  status: 'draft',
  category: 'chargeback',
  service_date: '2026-10-01',
  service_type: 'Carpet cleaning',
  invoice_number: 'INV-1001',
  description: 'Customer filed a chargeback after signing the completed work order.',
  review_url: null,
  review_rating: null,
  review_date: null,
  review_text: null,
  review_note: null,
  expires_at: null,
  created_at: '2026-10-02T10:00:00Z',
};

const customer = {
  incident_id: 'i1',
  full_name: 'John Smith',
  phone: '+12065550100',
  email: 'john@example.com',
  address_line1: '123 Main St',
  address_line2: null,
  city: 'Seattle',
  state: 'WA',
  postal_code: '98101',
};

const invoiceEvidence = {
  id: 'e1',
  incident_id: 'i1',
  kind: 'invoice',
  file_name: 'invoice.pdf',
  storage_path: 'b1/i1/abc.pdf',
  uploaded_at: '2026-10-02T11:00:00Z',
};

function withIncident(
  overrides: Record<string, unknown> = {},
  evidence: unknown[] = [],
): Partial<FakeState> {
  return {
    ...as.verifiedOwner,
    tables: {
      incidents: [{ ...incident, ...overrides }],
      incident_customers: [customer],
      incident_evidence: evidence,
      incident_events: [
        {
          id: 1,
          incident_id: 'i1',
          action: 'created',
          note: null,
          created_at: '2026-10-02T10:00:00Z',
        },
      ],
    },
  };
}

async function fillReport() {
  await typeText(await screen.findByLabelText('Customer name'), 'John Smith');
  await typeText(screen.getByLabelText('Customer phone'), '(206) 555-0100');
  await typeText(screen.getByLabelText('Customer email'), 'john@example.com');
  await typeText(screen.getByLabelText('Street address'), '123 Main St');
  await typeText(screen.getByLabelText('City'), 'Seattle');
  await userEvent.selectOptions(screen.getByLabelText('State'), 'WA');
  await typeText(screen.getByLabelText('ZIP code'), '98101');
  await typeText(screen.getByLabelText('Date of service'), '2026-10-01');
  await typeText(screen.getByLabelText('Type of service'), 'Carpet cleaning');
  await typeText(screen.getByLabelText('Invoice or job number (optional)'), 'INV-1001');
  await userEvent.selectOptions(screen.getByLabelText('What kind of dispute?'), 'chargeback');
  await typeText(
    screen.getByLabelText('What happened?'),
    'Customer filed a chargeback after signing the completed work order.',
  );
}

describe('report an incident', () => {
  it('saves a draft with the customer, service and dispute, then opens it', async () => {
    const { fake, path } = renderApp('/incidents/new', as.verifiedOwner);
    fake.whenRpc('create_incident', { data: 'i-new', error: null });

    await fillReport();
    await userEvent.click(screen.getByRole('button', { name: 'Save and add evidence' }));

    expect(fake.mocks.rpc).toHaveBeenCalledWith('create_incident', {
      p_category: 'chargeback',
      p_service_date: '2026-10-01',
      p_service_type: 'Carpet cleaning',
      p_invoice_number: 'INV-1001',
      p_description: 'Customer filed a chargeback after signing the completed work order.',
      p_customer: {
        full_name: 'John Smith',
        phone: '+12065550100',
        email: 'john@example.com',
        address_line1: '123 Main St',
        address_line2: '',
        city: 'Seattle',
        state: 'WA',
        postal_code: '98101',
      },
      p_review: null,
    });
    await waitFor(() => expect(path()).toBe('/incidents/i-new'));
  });

  it('includes the Google review when one is involved', async () => {
    const { fake } = renderApp('/incidents/new', as.verifiedOwner);
    fake.whenRpc('create_incident', { data: 'i-new', error: null });

    await fillReport();
    await userEvent.click(screen.getByLabelText('A Google review is involved'));
    await typeText(screen.getByLabelText('Link to the review'), 'https://g.page/r/abc/review');
    await userEvent.selectOptions(screen.getByLabelText('Star rating'), '1');
    await typeText(screen.getByLabelText('Review date'), '2026-10-03');
    await typeText(screen.getByLabelText('Review text (optional)'), 'Terrible service!');
    await userEvent.click(screen.getByRole('button', { name: 'Save and add evidence' }));

    expect(fake.mocks.rpc).toHaveBeenCalledWith(
      'create_incident',
      expect.objectContaining({
        p_review: {
          url: 'https://g.page/r/abc/review',
          rating: 1,
          date: '2026-10-03',
          text: 'Terrible service!',
        },
      }),
    );
  });

  it('explains a customer phone number that is not a US number', async () => {
    const { fake } = renderApp('/incidents/new', as.verifiedOwner);
    await fillReport();
    await userEvent.clear(screen.getByLabelText('Customer phone'));
    await typeText(screen.getByLabelText('Customer phone'), '555-0100');
    await userEvent.click(screen.getByRole('button', { name: 'Save and add evidence' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('10-digit US phone number');
    expect(fake.mocks.rpc).not.toHaveBeenCalledWith('create_incident', expect.anything());
  });

  it('shows the server reason when the report is refused', async () => {
    const { fake } = renderApp('/incidents/new', as.verifiedOwner);
    fake.whenRpc('create_incident', {
      data: null,
      error: { code: '22023', message: "The service date can't be in the future" },
    });
    await fillReport();
    await userEvent.click(screen.getByRole('button', { name: 'Save and add evidence' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The service date can't be in the future",
    );
  });

  it('reminds people this is a factual case file', async () => {
    renderApp('/incidents/new', as.verifiedOwner);
    expect(
      await screen.findByText(/Stick to facts you can show with evidence/),
    ).toBeInTheDocument();
  });
});

describe('my incidents', () => {
  it('lists the business’s reports with their status', async () => {
    renderApp('/incidents', {
      ...as.verifiedOwner,
      tables: { incidents: [{ ...incident, status: 'submitted' }], incident_customers: [customer] },
    });
    const list = await screen.findByRole('list', { name: 'Incidents' });
    const link = await within(list).findByRole('link', { name: /Chargeback/ });
    expect(link).toHaveAttribute('href', '/incidents/i1');
    expect(link).toHaveTextContent('Waiting for review');
  });

  it('invites a first report when there are none', async () => {
    renderApp('/incidents', as.verifiedOwner);
    expect(await screen.findByText('No incidents reported yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report incident' })).toHaveAttribute(
      'href',
      '/incidents/new',
    );
  });
});

describe('incident page', () => {
  it('shows the report and its customer', async () => {
    renderApp('/incidents/i1', withIncident());
    expect(await screen.findByRole('heading', { name: 'Chargeback' })).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('John Smith')).toBeInTheDocument();
  });

  it('uploads evidence into the incident’s private folder', async () => {
    const { fake } = renderApp('/incidents/i1', withIncident());
    const file = new File(['%PDF invoice'], 'Invoice 1001.pdf', { type: 'application/pdf' });

    await userEvent.selectOptions(await screen.findByLabelText('Evidence type'), 'invoice');
    await userEvent.upload(screen.getByLabelText('Choose file'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload evidence' }));

    await waitFor(() => expect(fake.bucket.upload).toHaveBeenCalled());
    expect(fake.mocks.storage.from).toHaveBeenCalledWith('incident-evidence');
    const [path] = fake.bucket.upload.mock.calls[0] as unknown as [string];
    expect(path).toMatch(/^b1\/i1\/[0-9a-f-]+\.pdf$/);
    await waitFor(() =>
      expect(fake.mocks.rpc).toHaveBeenCalledWith('add_incident_evidence', {
        p_incident_id: 'i1',
        p_kind: 'invoice',
        p_storage_path: path,
        p_file_name: 'Invoice 1001.pdf',
        p_mime_type: 'application/pdf',
        p_size_bytes: file.size,
        p_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it('lists evidence and can remove it before submitting', async () => {
    const { fake } = renderApp('/incidents/i1', withIncident({}, [invoiceEvidence]));
    fake.whenRpc('remove_incident_evidence', { data: 'b1/i1/abc.pdf', error: null });
    const list = await screen.findByRole('list', { name: 'Evidence' });
    expect(await within(list).findByText('invoice.pdf')).toBeInTheDocument();
    await userEvent.click(within(list).getByRole('button', { name: 'Remove invoice.pdf' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('remove_incident_evidence', {
      p_evidence_id: 'e1',
    });
    await waitFor(() => expect(fake.bucket.remove).toHaveBeenCalledWith(['b1/i1/abc.pdf']));
  });

  it('submits the incident for review', async () => {
    const { fake } = renderApp('/incidents/i1', withIncident({}, [invoiceEvidence]));
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('submit_incident', { p_incident_id: 'i1' });
  });

  it('saves changes to a draft', async () => {
    const { fake } = renderApp('/incidents/i1', withIncident());
    await screen.findByDisplayValue('John Smith');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith(
      'update_incident',
      expect.objectContaining({ p_incident_id: 'i1', p_category: 'chargeback' }),
    );
  });

  it('locks the report while it is being reviewed', async () => {
    renderApp('/incidents/i1', withIncident({ status: 'submitted' }, [invoiceEvidence]));
    expect(await screen.findByText(/A moderator is reviewing this incident/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload evidence' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });

  it('shows what the moderator needs and allows changes again', async () => {
    renderApp(
      '/incidents/i1',
      withIncident({ status: 'needs_info', review_note: 'Please add the signed work order.' }, [
        invoiceEvidence,
      ]),
    );
    expect(await screen.findByText('Please add the signed work order.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload evidence' })).toBeInTheDocument();
  });

  it('shows when a verified incident expires', async () => {
    renderApp(
      '/incidents/i1',
      withIncident({ status: 'evidence_verified', expires_at: '2031-10-01T00:00:00Z' }, [
        invoiceEvidence,
      ]),
    );
    expect(
      await screen.findByText(/Evidence verified\. This record expires on/),
    ).toBeInTheDocument();
  });

  it('shows the history', async () => {
    renderApp('/incidents/i1', withIncident());
    const history = await screen.findByRole('list', { name: 'History' });
    expect(await within(history).findByText('Report started')).toBeInTheDocument();
  });
});

describe('incident edge cases', () => {
  it('explains a report a moderator could not verify', async () => {
    renderApp(
      '/incidents/i1',
      withIncident({ status: 'rejected', review_note: 'The invoice is for a different address.' }, [
        invoiceEvidence,
      ]),
    );
    expect(await screen.findByText('The invoice is for a different address.')).toBeInTheDocument();
    expect(screen.getByText(/could not verify this incident/)).toBeInTheDocument();
  });

  it('shows the report read-only once it is locked', async () => {
    renderApp(
      '/incidents/i1',
      withIncident(
        {
          status: 'submitted',
          review_url: 'https://g.page/r/abc',
          review_rating: 1,
          review_date: '2026-10-03',
        },
        [invoiceEvidence],
      ),
    );
    expect(await screen.findByText(/Carpet cleaning on 2026-10-01/)).toBeInTheDocument();
    expect(screen.getByText(/1 star\(s\), 2026-10-03/)).toBeInTheDocument();
  });

  it('asks for a dispute type before saving', async () => {
    const { fake } = renderApp('/incidents/new', as.verifiedOwner);
    await typeText(await screen.findByLabelText('Customer name'), 'John Smith');
    await userEvent.click(screen.getByRole('button', { name: 'Save and add evidence' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose what kind of dispute');
    expect(fake.mocks.rpc).not.toHaveBeenCalledWith('create_incident', expect.anything());
  });

  it('asks for the evidence type and file before uploading', async () => {
    const { fake } = renderApp('/incidents/i1', withIncident());
    await userEvent.click(await screen.findByRole('button', { name: 'Upload evidence' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose the evidence type.');
    await userEvent.selectOptions(screen.getByLabelText('Evidence type'), 'invoice');
    await userEvent.click(screen.getByRole('button', { name: 'Upload evidence' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a file to upload.');
    expect(fake.bucket.upload).not.toHaveBeenCalled();
  });

  it('refuses files over 15 MB', async () => {
    const { fake } = renderApp('/incidents/i1', withIncident());
    const big = new File([new Uint8Array(16 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
    await userEvent.selectOptions(
      await screen.findByLabelText('Evidence type'),
      'before_after_photo',
    );
    await userEvent.upload(screen.getByLabelText('Choose file'), big);
    await userEvent.click(screen.getByRole('button', { name: 'Upload evidence' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('over 15 MB');
    expect(fake.bucket.upload).not.toHaveBeenCalled();
  });

  it('removes the uploaded file when it cannot be recorded', async () => {
    const { fake } = renderApp('/incidents/i1', withIncident());
    fake.whenRpc('add_incident_evidence', {
      data: null,
      error: {
        code: '55000',
        message: 'This incident is being reviewed. Changes are locked until then.',
      },
    });
    await userEvent.selectOptions(await screen.findByLabelText('Evidence type'), 'invoice');
    await userEvent.upload(
      screen.getByLabelText('Choose file'),
      new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Upload evidence' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('being reviewed');
    const [path] = fake.bucket.upload.mock.calls[0] as unknown as [string];
    expect(fake.bucket.remove).toHaveBeenCalledWith([path]);
  });

  it('explains why a submission was refused', async () => {
    const { fake } = renderApp('/incidents/i1', withIncident());
    fake.whenRpc('submit_incident', {
      data: null,
      error: { code: '22023', message: 'Add at least one piece of evidence' },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add at least one piece of evidence',
    );
  });

  it('explains why saving changes failed', async () => {
    const { fake } = renderApp('/incidents/i1', withIncident());
    fake.whenRpc('update_incident', {
      data: null,
      error: { code: '22023', message: 'Describe what happened in at least 20 characters' },
    });
    await screen.findByDisplayValue('John Smith');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 20 characters');
  });

  it('shows when an incident cannot be loaded', async () => {
    const { fake } = renderApp('/incidents/missing', as.verifiedOwner);
    fake.query.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    } as never);
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });
});
