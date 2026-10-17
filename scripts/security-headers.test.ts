import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders, cspSources } from './security-headers.mjs';

function csp(headers: string): string {
  return /Content-Security-Policy: (.*)/.exec(headers)?.[1] ?? '';
}

describe('cspSources', () => {
  it('allows only the real Supabase project, over HTTPS and secure websockets', () => {
    expect(cspSources({ supabaseUrl: 'https://abcd.supabase.co' })).toEqual({
      connect: ['https://abcd.supabase.co', 'wss://abcd.supabase.co'],
      img: ['https://abcd.supabase.co'],
    });
  });

  it('adds the Sentry ingest host when error tracking is on', () => {
    const sources = cspSources({
      supabaseUrl: 'https://abcd.supabase.co',
      sentryDsn: 'https://publickey@o123.ingest.us.sentry.io/456',
    });
    expect(sources.connect).toContain('https://o123.ingest.us.sentry.io');
    expect(sources.connect.join(' ')).not.toContain('publickey');
  });

  it('allows the local database for local preview builds', () => {
    expect(cspSources({ supabaseUrl: 'http://127.0.0.1:54321' }).connect).toEqual([
      'http://127.0.0.1:54321',
      'ws://127.0.0.1:54321',
    ]);
  });

  it('falls back to any Supabase project when no URL is configured', () => {
    expect(cspSources({}).connect).toEqual(['https://*.supabase.co', 'wss://*.supabase.co']);
  });

  it('ignores a malformed Sentry DSN instead of breaking the build', () => {
    expect(
      cspSources({ supabaseUrl: 'https://abcd.supabase.co', sentryDsn: 'nope' }).connect,
    ).toEqual(['https://abcd.supabase.co', 'wss://abcd.supabase.co']);
  });
});

describe('buildSecurityHeaders', () => {
  const headers = buildSecurityHeaders({ supabaseUrl: 'https://abcd.supabase.co' });

  it('locks scripts, frames and forms to the app itself', () => {
    const policy = csp(headers);
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
    expect(policy).not.toContain('*.supabase.co');
  });

  it('sends the standard hardening headers', () => {
    expect(headers).toContain(
      'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
    );
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin');
  });

  it('never caches the service worker, and caches hashed assets for a year', () => {
    expect(headers).toMatch(/\/sw\.js\n {2}Cache-Control: no-cache/);
    expect(headers).toMatch(/\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
  });

  it('keeps the admin panel out of search engines and off the camera', () => {
    const admin = buildSecurityHeaders({ supabaseUrl: 'https://abcd.supabase.co', admin: true });
    expect(admin).toContain('X-Robots-Tag: noindex, nofollow');
    expect(admin).toContain('camera=()');
    expect(headers).not.toContain('X-Robots-Tag');
    expect(headers).toContain('camera=(self)');
  });
});
