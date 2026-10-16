import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FakeState } from '@cs/core/testing';
import { describe, expect, it } from 'vitest';
import { as, ownerMembership, renderApp } from '../test/renderApp';

type Status = 'unverified' | 'pending' | 'needs_info' | 'rejected' | 'verified';

const emptyBusiness = {
  id: 'b1',
  name: 'Alpha Plumbing',
  verification_status: 'unverified',
  phone: null,
  address_line1: null,
  address_line2: null,
  city: null,
  state: null,
  postal_code: null,
  review_note: null,
};

const filledBusiness = {
  ...emptyBusiness,
  phone: '+12065550100',
  address_line1: '1 Main St',
  city: 'Seattle',
  state: 'WA',
  postal_code: '98101',
};

const licenseDoc = {
  id: 'd1',
  kind: 'business_license',
  file_name: 'license.pdf',
  storage_path: 'b1/abc.pdf',
  uploaded_at: '2026-10-16T12:00:00Z',
};

function ownerWith(
  business: Record<string, unknown>,
  documents: unknown[] = [],
  status: Status = 'unverified',
): Partial<FakeState> {
  return {
    ...as.owner,
    membership: {
      ...ownerMembership,
      business: { ...ownerMembership.business, verification_status: status },
    },
    tables: {
      businesses: [{ ...business, verification_status: status }],
      business_documents: documents,
    },
  };
}

describe('verification page: owner, not yet submitted', () => {
  it('shows the three steps', async () => {
    renderApp('/verification', ownerWith(emptyBusiness));
    expect(await screen.findByRole('heading', { name: '1. Business details' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2. Proof documents' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3. Submit for review' })).toBeInTheDocument();
  });

  it('saves the business phone and address', async () => {
    const { fake } = renderApp('/verification', ownerWith(emptyBusiness));

    await userEvent.type(await screen.findByLabelText('Business phone'), '(206) 555-0100');
    await userEvent.type(screen.getByLabelText('Street address'), '1 Main St');
    await userEvent.type(screen.getByLabelText('City'), 'Seattle');
    await userEvent.selectOptions(screen.getByLabelText('State'), 'WA');
    await userEvent.type(screen.getByLabelText('ZIP code'), '98101');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));

    expect(fake.mocks.rpc).toHaveBeenCalledWith('update_business_details', {
      p_phone: '+12065550100',
      p_address_line1: '1 Main St',
      p_address_line2: '',
      p_city: 'Seattle',
      p_state: 'WA',
      p_postal_code: '98101',
    });
    expect(await screen.findByText('Details saved.')).toBeInTheDocument();
  });

  it('fills in details that were saved before', async () => {
    renderApp('/verification', ownerWith(filledBusiness));
    expect(await screen.findByLabelText('Business phone')).toHaveValue('(206) 555-0100');
    expect(screen.getByLabelText('City')).toHaveValue('Seattle');
  });

  it('explains a phone number that is not a US number, without calling the server', async () => {
    const { fake } = renderApp('/verification', ownerWith(emptyBusiness));
    await userEvent.type(await screen.findByLabelText('Business phone'), '555-0100');
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a 10-digit US phone number');
    expect(fake.mocks.rpc).not.toHaveBeenCalledWith('update_business_details', expect.anything());
  });

  it('uploads a document privately and records its fingerprint', async () => {
    const { fake } = renderApp('/verification', ownerWith(filledBusiness));
    const file = new File(['%PDF-1.7 license'], 'My License.pdf', { type: 'application/pdf' });

    await userEvent.selectOptions(
      await screen.findByLabelText('Document type'),
      'business_license',
    );
    await userEvent.upload(screen.getByLabelText('Choose file'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));

    await waitFor(() => expect(fake.bucket.upload).toHaveBeenCalled());
    expect(fake.mocks.storage.from).toHaveBeenCalledWith('business-documents');
    const [path, uploaded, options] = fake.bucket.upload.mock.calls[0] as unknown as [
      string,
      File,
      { contentType: string; upsert: boolean },
    ];
    expect(path).toMatch(/^b1\/[0-9a-f-]+\.pdf$/);
    expect(uploaded).toBe(file);
    expect(options).toEqual({ contentType: 'application/pdf', upsert: false });

    await waitFor(() =>
      expect(fake.mocks.rpc).toHaveBeenCalledWith('add_business_document', {
        p_kind: 'business_license',
        p_storage_path: path,
        p_file_name: 'My License.pdf',
        p_mime_type: 'application/pdf',
        p_size_bytes: file.size,
        p_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it('refuses unsupported files before uploading', async () => {
    const { fake } = renderApp('/verification', ownerWith(filledBusiness));
    const file = new File(['x'], 'notes.docx', { type: 'application/msword' });

    await userEvent.selectOptions(await screen.findByLabelText('Document type'), 'ein_letter');
    await userEvent.upload(screen.getByLabelText('Choose file'), file, { applyAccept: false });
    await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Upload a PDF or a photo');
    expect(fake.bucket.upload).not.toHaveBeenCalled();
  });

  it('cleans up the uploaded file if it cannot be recorded', async () => {
    const { fake } = renderApp('/verification', ownerWith(filledBusiness));
    fake.mocks.rpc.mockImplementation(async (name: string) =>
      name === 'add_business_document'
        ? ({
            data: null,
            error: {
              code: '55000',
              message: 'Your business is being reviewed. Changes are locked until then.',
            },
          } as never)
        : ({ data: null, error: null } as never),
    );
    const file = new File(['%PDF'], 'license.pdf', { type: 'application/pdf' });

    await userEvent.selectOptions(
      await screen.findByLabelText('Document type'),
      'business_license',
    );
    await userEvent.upload(screen.getByLabelText('Choose file'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Upload document' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('being reviewed');
    const [path] = fake.bucket.upload.mock.calls[0] as unknown as [string];
    expect(fake.bucket.remove).toHaveBeenCalledWith([path]);
  });

  it('lists uploaded documents and can remove one', async () => {
    const { fake } = renderApp('/verification', ownerWith(filledBusiness, [licenseDoc]));
    fake.mocks.rpc.mockImplementation(async (name: string) =>
      name === 'remove_business_document'
        ? ({ data: 'b1/abc.pdf', error: null } as never)
        : ({ data: null, error: null } as never),
    );
    const list = await screen.findByRole('list', { name: 'Uploaded documents' });
    expect(within(list).getByText('license.pdf')).toBeInTheDocument();
    expect(within(list).getByText('Business license')).toBeInTheDocument();

    await userEvent.click(within(list).getByRole('button', { name: 'Remove license.pdf' }));

    expect(fake.mocks.rpc).toHaveBeenCalledWith('remove_business_document', {
      p_document_id: 'd1',
    });
    await waitFor(() => expect(fake.bucket.remove).toHaveBeenCalledWith(['b1/abc.pdf']));
  });

  it('submits for review', async () => {
    const { fake } = renderApp('/verification', ownerWith(filledBusiness, [licenseDoc]));
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('submit_for_verification');
  });

  it('shows what is missing when submitting too early', async () => {
    const { fake } = renderApp('/verification', ownerWith(emptyBusiness));
    fake.mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '22023', message: 'Add your business phone and address first' },
    } as never);
    await userEvent.click(await screen.findByRole('button', { name: 'Submit for review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add your business phone and address first',
    );
  });
});

describe('verification page: after submitting', () => {
  it('locks editing while the review is in progress', async () => {
    renderApp('/verification', ownerWith(filledBusiness, [licenseDoc], 'pending'));
    expect(await screen.findByText(/We're reviewing your business/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument();
  });

  it('shows what the moderator needs', async () => {
    renderApp(
      '/verification',
      ownerWith(
        { ...filledBusiness, review_note: 'Your license is expired.' },
        [licenseDoc],
        'needs_info',
      ),
    );
    expect(await screen.findByText('Your license is expired.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeInTheDocument();
  });

  it('celebrates a verified business', async () => {
    renderApp('/verification', ownerWith(filledBusiness, [licenseDoc], 'verified'));
    expect(await screen.findByText(/Your business is verified/)).toBeInTheDocument();
  });
});

describe('verification page: staff', () => {
  it('shows the status but leaves changes to the owner', async () => {
    const state = ownerWith(filledBusiness, [licenseDoc]);
    state.membership = { ...state.membership!, role: 'staff' };
    renderApp('/verification', state);
    expect(await screen.findByText(/Only the owner can update verification/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save details' })).not.toBeInTheDocument();
  });
});

describe('locked features', () => {
  it('home shows checks and reports as locked until verified', async () => {
    renderApp('/', ownerWith(filledBusiness));
    const link = await screen.findByRole('link', { name: /Customer check/ });
    expect(link).toHaveAttribute('href', '/verification');
    expect(link).toHaveTextContent('Unlocks after verification');
  });

  it('opening a locked page explains and links to verification', async () => {
    renderApp('/check', ownerWith(filledBusiness));
    expect(
      await screen.findByRole('heading', { name: 'Verify your business first' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to verification' })).toHaveAttribute(
      'href',
      '/verification',
    );
  });

  it('a verified business can open them', async () => {
    renderApp('/check', ownerWith(filledBusiness, [], 'verified'));
    expect(await screen.findByRole('heading', { name: 'Customer check' })).toBeInTheDocument();
  });

  it('the account menu links to verification', async () => {
    const { path } = renderApp('/', ownerWith(filledBusiness));
    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Verification' }));
    await waitFor(() => expect(path()).toBe('/verification'));
  });
});
