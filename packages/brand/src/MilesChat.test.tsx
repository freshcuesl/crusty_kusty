import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { typeText } from '@cs/core/testing';
import { MilesAvatar, MilesChat, type MilesChatProps } from './MilesChat';

function setup(props: Partial<MilesChatProps> = {}) {
  const onSend = vi.fn();
  const onClose = vi.fn();
  render(
    <MilesChat
      open
      title="Report coach"
      intro="I'll help you write a clear, factual report."
      messages={[]}
      busy={false}
      error={null}
      onSend={onSend}
      onClose={onClose}
      {...props}
    />,
  );
  return { onSend, onClose };
}

describe('MilesChat', () => {
  it('introduces Miles and says he is an AI that can make mistakes', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: /Miles/ });
    expect(dialog).toHaveTextContent('Report coach');
    expect(dialog).toHaveTextContent("I'll help you write a clear, factual report.");
    expect(dialog).toHaveTextContent(/AI assistant and can make mistakes/);
  });

  it('sends what the person types and clears the box', async () => {
    const { onSend } = setup();
    const box = screen.getByRole('textbox', { name: 'Message Miles' });
    await typeText(box, 'Is this report clear?');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('Is this report clear?');
    expect(box).toHaveValue('');
  });

  it('sends with Enter, and Shift+Enter makes a new line', async () => {
    const { onSend } = setup();
    const box = screen.getByRole('textbox', { name: 'Message Miles' });
    await userEvent.type(box, 'Line one{Shift>}{Enter}{/Shift}Line two{Enter}');
    expect(onSend).toHaveBeenCalledWith('Line one\nLine two');
  });

  it('never sends an empty message', async () => {
    const { onSend } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('offers starter questions before the conversation begins', async () => {
    const { onSend } = setup({ suggestions: ['Review my report'] });
    await userEvent.click(screen.getByRole('button', { name: 'Review my report' }));
    expect(onSend).toHaveBeenCalledWith('Review my report');
  });

  it('shows the conversation in a live log', () => {
    setup({
      messages: [
        { role: 'user', content: 'Hi Miles' },
        { role: 'assistant', content: 'Hi! How can I help?' },
      ],
    });
    const log = screen.getByRole('log');
    expect(within(log).getByText('Hi Miles')).toBeInTheDocument();
    expect(within(log).getByText('Hi! How can I help?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review my report' })).not.toBeInTheDocument();
  });

  it('shows when Miles is thinking and blocks double sending', () => {
    setup({ busy: true });
    expect(screen.getByText(/Miles is thinking/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('shows errors and closes', async () => {
    const { onClose } = setup({ error: 'Miles is unavailable right now.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Miles is unavailable right now.');
    await userEvent.click(screen.getByRole('button', { name: 'Close Miles' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('can show something else instead of the message box, like an upgrade note', () => {
    setup({ blocked: <p>Miles is included in Pro and Team.</p> });
    expect(screen.getByText('Miles is included in Pro and Team.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Message Miles' })).not.toBeInTheDocument();
  });

  it('shows Miles as a service pro, with a name for screen readers when asked', () => {
    render(<MilesAvatar size={48} title="Miles, customer service" />);
    const picture = screen.getByRole('img', { name: 'Miles, customer service' });
    expect(picture).toHaveAttribute('width', '48');
  });
});
