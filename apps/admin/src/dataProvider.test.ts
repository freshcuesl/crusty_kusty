import { describe, expect, it } from 'vitest';
import { dataProvider } from './dataProvider';

describe('placeholder dataProvider', () => {
  it('refuses every call until Supabase is connected, so nothing fakes a save', async () => {
    await expect(dataProvider.getList('businesses', {})).rejects.toThrow(/not connected/);
    await expect(
      dataProvider.update('businesses', { id: 1, data: {}, previousData: {} }),
    ).rejects.toThrow(/not connected/);
  });
});
