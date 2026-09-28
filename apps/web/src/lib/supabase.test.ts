import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn(() => ({ auth: {} }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

beforeEach(() => {
  vi.resetModules();
  createClient.mockClear();
  vi.unstubAllEnvs();
});

describe('getSupabase', () => {
  it('connects with the validated URL and public key', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
    const { getSupabase } = await import('./supabase');

    getSupabase();

    expect(createClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true, flowType: 'pkce' }),
      }),
    );
  });

  it('reuses one client for the whole app', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
    const { getSupabase } = await import('./supabase');

    expect(getSupabase()).toBe(getSupabase());
    expect(createClient).toHaveBeenCalledOnce();
  });

  it('fails with setup directions when configuration is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { getSupabase } = await import('./supabase');

    expect(() => getSupabase()).toThrow(/docs\/setup/);
  });
});
