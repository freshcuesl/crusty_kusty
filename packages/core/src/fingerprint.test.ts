import { describe, expect, it } from 'vitest';
import { sha256Hex } from './fingerprint';

describe('sha256Hex', () => {
  it('fingerprints file contents', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    expect(await sha256Hex(file)).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('changes when even one byte changes', async () => {
    expect(await sha256Hex(new Blob(['hello']))).not.toBe(await sha256Hex(new Blob(['hellO'])));
  });
});
