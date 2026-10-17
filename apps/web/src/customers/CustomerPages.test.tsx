import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { typeText } from '@cs/core/testing';
import { describe, expect, it } from 'vitest';
import { as, ownerMembership, renderApp, testUser } from '../test/renderApp';

const jane = {
  id: 'cu1',
  full_name: 'Jane Doe',
  phone: '+12065550199',
  email: 'jane@example.com',
  address_line1: '9 Pine St',
  address_line2: null,
  city: 'Seattle',
  state: 'WA',
  postal_code: '98101',
  created_at: '2026-10-10T12:00:00Z',
};

const notes = [
  {
    id: 'n1',
    body: 'Prefers morning visits.',
    author_id: testUser.id,
    created_at: '2026-10-11T12:00:00Z',
  },
  {
    id: 'n2',
    body: 'Dog in the yard.',
    author_id: 'someone-else',
    created_at: '2026-10-10T12:00:00Z',
  },
];

const verifiedStaff = {
  ...as.verifiedOwner,
  membership: {
    role: 'staff' as const,
    business: { ...ownerMembership.business, verification_status: 'verified' },
  },
};

describe('customers list', () => {
  it('lists saved customers with links to their records', async () => {
    renderApp('/customers', { ...as.verifiedOwner, tables: { customers: [jane] } });
    const list = await screen.findByRole('list', { name: 'Customers' });
    const link = within(list).getByRole('link', { name: /Jane Doe/ });
    expect(link).toHaveAttribute('href', '/customers/cu1');
    expect(link).toHaveTextContent('(206) 555-0199');
  });

  it('points to New customer when there are none yet', async () => {
    renderApp('/customers', as.verifiedOwner);
    expect(await screen.findByText(/No saved customers yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New customer' })).toHaveAttribute(
      'href',
      '/customers/new',
    );
  });

  it('is on the home screen', async () => {
    const { path } = renderApp('/', as.verifiedOwner);
    await userEvent.click(await screen.findByRole('link', { name: /Customers/ }));
    await waitFor(() => expect(path()).toBe('/customers'));
  });
});

describe('customer record', () => {
  function openJane(state = as.verifiedOwner) {
    return renderApp('/customers/cu1', {
      ...state,
      tables: { customers: [jane], customer_notes: notes },
    });
  }

  it('shows the customer details', async () => {
    openJane();
    expect(await screen.findByRole('heading', { name: 'Jane Doe' })).toBeInTheDocument();
    expect(screen.getByText('(206) 555-0199')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('9 Pine St, Seattle, WA 98101')).toBeInTheDocument();
  });

  it('explains that notes are private', async () => {
    openJane();
    expect(await screen.findByRole('heading', { name: 'Private notes' })).toBeInTheDocument();
    expect(screen.getByText(/never shared with other businesses/)).toBeInTheDocument();
  });

  it('lists notes, newest first', async () => {
    openJane();
    const list = await screen.findByRole('list', { name: 'Notes' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Prefers morning visits.');
    expect(items[1]).toHaveTextContent('Dog in the yard.');
  });

  it('adds a note', async () => {
    const { fake } = openJane();
    fake.whenRpc('add_customer_note', { data: 'n3', error: null });
    await typeText(await screen.findByLabelText('New note'), 'Gate code is 1234');
    await userEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('add_customer_note', {
      p_customer_id: 'cu1',
      p_body: 'Gate code is 1234',
    });
    await waitFor(() => expect(screen.getByLabelText('New note')).toHaveValue(''));
  });

  it('explains why a note was refused', async () => {
    const { fake } = openJane();
    fake.whenRpc('add_customer_note', {
      data: null,
      error: { code: '22023', message: 'Write a note first' },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Write a note first');
  });

  it('lets the owner delete any note', async () => {
    const { fake } = openJane();
    const list = await screen.findByRole('list', { name: 'Notes' });
    expect(within(list).getAllByRole('button', { name: /Delete note/ })).toHaveLength(2);
    await userEvent.click(within(list).getAllByRole('button', { name: /Delete note/ })[1]!);
    expect(fake.mocks.rpc).toHaveBeenCalledWith('delete_customer_note', { p_note_id: 'n2' });
  });

  it('lets staff delete only their own notes', async () => {
    openJane(verifiedStaff);
    const list = await screen.findByRole('list', { name: 'Notes' });
    const buttons = within(list).getAllByRole('button', { name: /Delete note/ });
    expect(buttons).toHaveLength(1);
    expect(within(list).getAllByRole('listitem')[0]).toContainElement(buttons[0]!);
  });

  it('checks the customer again and shows the result', async () => {
    const { fake } = openJane();
    fake.whenRpc('recheck_customer', {
      data: { check_id: 'c9', alert_id: null, incident_count: 0, incidents: [] },
      error: null,
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Check again' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('recheck_customer', { p_customer_id: 'cu1' });
    expect(await screen.findByText(/No verified incidents found/)).toBeInTheDocument();
  });

  it('lets the owner delete the record after confirming', async () => {
    const { fake, path } = openJane();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete customer' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(/notes are deleted too/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete customer' }));
    expect(fake.mocks.rpc).toHaveBeenCalledWith('delete_customer', { p_customer_id: 'cu1' });
    await waitFor(() => expect(path()).toBe('/customers'));
  });

  it('does not offer staff the delete button', async () => {
    openJane(verifiedStaff);
    await screen.findByRole('heading', { name: 'Jane Doe' });
    expect(screen.queryByRole('button', { name: 'Delete customer' })).not.toBeInTheDocument();
  });

  it('explains when a re-check is refused', async () => {
    const { fake } = openJane();
    fake.whenRpc('recheck_customer', {
      data: null,
      error: {
        code: '54000',
        message: 'Daily check limit reached. Contact support if you need more.',
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Check again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Daily check limit reached');
  });

  it('explains when a record cannot be deleted', async () => {
    const { fake, path } = openJane();
    fake.whenRpc('delete_customer', {
      data: null,
      error: { code: '42501', message: 'Only the owner can delete customer records' },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete customer' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete customer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only the owner');
    expect(path()).toBe('/customers/cu1');
  });

  it('explains a lost connection while saving a note', async () => {
    const { fake } = openJane();
    fake.whenRpc('add_customer_note', () => {
      throw new TypeError('Failed to fetch');
    });
    await typeText(await screen.findByLabelText('New note'), 'Hello');
    await userEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server");
  });

  it('explains a lost connection during a re-check or delete', async () => {
    const { fake } = openJane();
    fake.whenRpc('recheck_customer', () => {
      throw new TypeError('Failed to fetch');
    });
    fake.whenRpc('delete_customer', () => {
      throw new TypeError('Failed to fetch');
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Check again' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server");
    await userEvent.click(screen.getByRole('button', { name: 'Delete customer' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete customer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent("Can't reach the server");
  });

  it('says when a customer cannot be found', async () => {
    renderApp('/customers/missing', as.verifiedOwner);
    expect(await screen.findByRole('alert')).toHaveTextContent('Customer not found');
  });
});

describe('after adding a customer', () => {
  it('links to the new customer record', async () => {
    const { fake } = renderApp('/customers/new', as.verifiedOwner);
    fake.whenRpc('add_customer', {
      data: {
        check_id: 'c1',
        alert_id: null,
        incident_count: 0,
        incidents: [],
        customer_id: 'cu7',
      },
      error: null,
    });
    await typeText(await screen.findByLabelText('Customer name'), 'Jane Doe');
    await typeText(screen.getByLabelText('Customer phone'), '(206) 555-0199');
    await userEvent.click(screen.getByRole('button', { name: 'Add and check customer' }));
    expect(await screen.findByRole('link', { name: 'Open customer record' })).toHaveAttribute(
      'href',
      '/customers/cu7',
    );
  });
});
