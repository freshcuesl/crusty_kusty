import userEvent from '@testing-library/user-event';

/**
 * Fills a field the way paste and autofill do: one input event instead of one
 * per key. Typing key by key re-renders the whole page each time and made form
 * tests take ~10 seconds.
 */
export async function typeText(element: Element, text: string): Promise<void> {
  await userEvent.click(element);
  await userEvent.paste(text);
}
