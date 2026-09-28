import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const valid = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_ANON_KEY: 'public-anon-key',
};

describe('parseEnv', () => {
  it('returns typed config when all variables are present', () => {
    expect(parseEnv(valid)).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseAnonKey: 'public-anon-key',
    });
  });

  it('names every missing variable in one clear message', () => {
    expect(() => parseEnv({})).toThrow(/VITE_SUPABASE_URL.*VITE_SUPABASE_ANON_KEY/s);
  });

  it('points the developer at the setup guide', () => {
    expect(() => parseEnv({})).toThrow(/docs\/setup/);
  });

  it('rejects a Supabase URL that is not a URL', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_URL: 'not a url' })).toThrow(
      /VITE_SUPABASE_URL/,
    );
  });

  it('refuses a service-role key in the browser', () => {
    // A service_role JWT bypasses row-level security and must never ship to clients.
    const payload = btoa(JSON.stringify({ role: 'service_role' }));
    const serviceKey = `header.${payload}.signature`;
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_ANON_KEY: serviceKey })).toThrow(
      /service.role/i,
    );
  });

  it('refuses a new-style secret key in the browser', () => {
    expect(() => parseEnv({ ...valid, VITE_SUPABASE_ANON_KEY: 'sb_secret_abc123' })).toThrow(
      /secret key/i,
    );
  });

  it('accepts a new-style publishable key', () => {
    expect(
      parseEnv({ ...valid, VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc123' }).supabaseAnonKey,
    ).toBe('sb_publishable_abc123');
  });
});
