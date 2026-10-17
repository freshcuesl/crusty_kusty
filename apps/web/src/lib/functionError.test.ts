import { describe, expect, it } from 'vitest';
import { functionErrorMessage } from './functionError';

describe('functionErrorMessage', () => {
  it('uses the message our Edge Function sent', async () => {
    const error = { context: new Response(JSON.stringify({ error: 'Choose a plan first.' })) };
    expect(await functionErrorMessage(error)).toBe('Choose a plan first.');
  });

  it('falls back to a friendly message when the reply is not ours', async () => {
    expect(await functionErrorMessage({ context: new Response('<html>Bad gateway</html>') })).toBe(
      'Something went wrong. Try again in a moment.',
    );
    expect(await functionErrorMessage({ context: new Response('{"other":1}') })).toBe(
      'Something went wrong. Try again in a moment.',
    );
    expect(await functionErrorMessage(null)).toBe('Something went wrong. Try again in a moment.');
  });
});
