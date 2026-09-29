import { describe, expect, it, vi } from 'vitest';
import { createSupabaseClient } from './supabase';

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

describe('createSupabaseClient', () => {
  it('connects with the validated URL and public key, using PKCE', () => {
    createSupabaseClient({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_test',
    });
    expect(createClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: true, flowType: 'pkce' }),
      }),
    );
  });

  it('fails with setup directions when configuration is missing', () => {
    expect(() => createSupabaseClient({})).toThrow(/docs\/setup/);
  });
});
