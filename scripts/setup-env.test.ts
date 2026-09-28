import { describe, expect, it } from 'vitest';
import { buildEnvFile } from './setup-env.mjs';

describe('buildEnvFile', () => {
  it('writes the local API URL and the publishable key', () => {
    const env = buildEnvFile({
      API_URL: 'http://127.0.0.1:54321',
      PUBLISHABLE_KEY: 'sb_publishable_local',
      ANON_KEY: 'legacy-anon',
      SECRET_KEY: 'sb_secret_local',
      SERVICE_ROLE_KEY: 'service-role',
    });
    expect(env).toContain('VITE_SUPABASE_URL=http://127.0.0.1:54321');
    expect(env).toContain('VITE_SUPABASE_ANON_KEY=sb_publishable_local');
  });

  it('falls back to the legacy anon key on older Supabase CLIs', () => {
    const env = buildEnvFile({ API_URL: 'http://127.0.0.1:54321', ANON_KEY: 'legacy-anon' });
    expect(env).toContain('VITE_SUPABASE_ANON_KEY=legacy-anon');
  });

  it('never writes admin keys into the browser config', () => {
    const env = buildEnvFile({
      API_URL: 'http://127.0.0.1:54321',
      PUBLISHABLE_KEY: 'sb_publishable_local',
      SECRET_KEY: 'sb_secret_local',
      SERVICE_ROLE_KEY: 'service-role',
    });
    expect(env).not.toContain('sb_secret_local');
    expect(env).not.toContain('service-role');
  });

  it('explains what to do when Supabase is not running', () => {
    expect(() => buildEnvFile({})).toThrow(/npm run db:start/);
  });
});
