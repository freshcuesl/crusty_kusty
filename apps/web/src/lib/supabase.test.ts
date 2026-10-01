import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSupabaseClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));
vi.mock('@cs/core', () => ({ createSupabaseClient }));

beforeEach(() => {
  vi.resetModules();
  createSupabaseClient.mockClear();
});

describe('getSupabase', () => {
  it('reuses one client for the whole app', async () => {
    const { getSupabase } = await import('./supabase');
    expect(getSupabase()).toBe(getSupabase());
    expect(createSupabaseClient).toHaveBeenCalledOnce();
  });

  it('passes the Vite environment through for validation', async () => {
    const { getSupabase } = await import('./supabase');
    getSupabase();
    expect(createSupabaseClient).toHaveBeenCalledWith(import.meta.env);
  });
});
