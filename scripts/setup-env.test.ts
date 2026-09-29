import { describe, expect, it } from 'vitest';
import { buildCloudEnvFile, buildEnvFile } from './setup-env.mjs';

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

describe('buildCloudEnvFile', () => {
  const url = 'https://mnmlvmctxponwzltixub.supabase.co';

  it('writes the cloud project URL and publishable key', () => {
    const env = buildCloudEnvFile({ url: `${url}/`, key: ' sb_publishable_abc ' });
    expect(env).toContain(`VITE_SUPABASE_URL=${url}`);
    expect(env).toContain('VITE_SUPABASE_ANON_KEY=sb_publishable_abc');
  });

  it('accepts the older anon key format', () => {
    const payload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');
    expect(buildCloudEnvFile({ url, key: `h.${payload}.s` })).toContain(
      `VITE_SUPABASE_ANON_KEY=h.${payload}.s`,
    );
  });

  it('refuses the secret key, which must never reach a browser', () => {
    expect(() => buildCloudEnvFile({ url, key: 'sb_secret_abc' })).toThrow(/secret key/i);
  });

  it('refuses the old service_role key too', () => {
    const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
    expect(() => buildCloudEnvFile({ url, key: `h.${payload}.s` })).toThrow(/secret key/i);
  });

  it('only accepts a Supabase project URL', () => {
    expect(() =>
      buildCloudEnvFile({ url: 'https://example.com', key: 'sb_publishable_abc' }),
    ).toThrow(/Project URL/);
    expect(() => buildCloudEnvFile({ url: 'not a url', key: 'sb_publishable_abc' })).toThrow(
      /Project URL/,
    );
  });

  it('asks for the key when it is empty', () => {
    expect(() => buildCloudEnvFile({ url, key: '  ' })).toThrow(/publishable key/);
  });
});
