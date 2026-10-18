import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { typeText } from '@cs/core/testing';
import { describe, expect, it } from 'vitest';
import { as, renderApp } from '../test/renderApp';

async function openMiles() {
  await userEvent.click(await screen.findByRole('button', { name: 'Ask Miles' }));
  return screen.findByRole('dialog', { name: /Miles/ });
}

describe('Ask Miles (customer service)', () => {
  it('is on every app page, for every plan', async () => {
    renderApp('/', as.verifiedOwner);
    const dialog = await openMiles();
    expect(dialog).toHaveTextContent('Customer service');
    expect(within(dialog).getByRole('textbox', { name: 'Message Miles' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'How do customer checks work?' }),
    ).toBeInTheDocument();
  });

  it('helps people who are still getting verified', async () => {
    renderApp('/verification', as.owner);
    expect(await openMiles()).toHaveTextContent('Customer service');
  });

  it('sends the question and shows the reply', async () => {
    const { fake } = renderApp('/', as.verifiedOwner);
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
      body: { messages: [{ role: 'user', content: 'How do customer checks work?' }] },
    });
    const log = within(dialog).getByRole('log');
    expect(await within(log).findByText(/compares at least two details/)).toBeInTheDocument();
  });

  it('keeps the conversation for follow-up questions, even after closing', async () => {
    const { fake } = renderApp('/', as.verifiedOwner);
    fake.mocks.functions.invoke
      .mockResolvedValueOnce({ data: { reply: 'First answer.' }, error: null } as never)
      .mockResolvedValueOnce({ data: { reply: 'Second answer.' }, error: null } as never);
    const dialog = await openMiles();
    const box = within(dialog).getByRole('textbox', { name: 'Message Miles' });
    await typeText(box, 'First question');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    await within(dialog).findByText('First answer.');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close Miles' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const again = await openMiles();
    await typeText(within(again).getByRole('textbox', { name: 'Message Miles' }), 'Follow-up');
    await userEvent.click(within(again).getByRole('button', { name: 'Send' }));
    await within(again).findByText('Second answer.');

    expect(fake.mocks.functions.invoke).toHaveBeenLastCalledWith('miles', {
      method: 'POST',
      body: {
        messages: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer.' },
          { role: 'user', content: 'Follow-up' },
        ],
      },
    });
  });

  it('explains when Miles cannot answer', async () => {
    const { fake } = renderApp('/', as.verifiedOwner);
    fake.mocks.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: {
        name: 'FunctionsHttpError',
        context: new Response(
          JSON.stringify({
            error: 'Miles has answered 20 messages for you today. Try again tomorrow.',
          }),
          { status: 429 },
        ),
      },
    } as never);
    const dialog = await openMiles();
    await typeText(within(dialog).getByRole('textbox', { name: 'Message Miles' }), 'Hi');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('20 messages');
  });

  it('explains a lost connection', async () => {
    const { fake } = renderApp('/', as.verifiedOwner);
    fake.mocks.functions.invoke.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const dialog = await openMiles();
    await typeText(within(dialog).getByRole('textbox', { name: 'Message Miles' }), 'Hi');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("Can't reach the server");
  });

  it('stays out of incidents and alerts: it is customer service, not a work tool', async () => {
    renderApp('/alerts', as.verifiedOwner);
    await screen.findByRole('heading', { name: 'Alerts' });
    expect(screen.queryByRole('button', { name: /Ask Miles about/ })).not.toBeInTheDocument();
  });
});
