import { describe, expect, it } from 'vitest';
import { maskPersonalData, monitoringOptions, scrubEvent } from './monitoring';

describe('maskPersonalData', () => {
  it('hides email addresses and US phone numbers', () => {
    expect(maskPersonalData('Check failed for john.smith+x@example.com')).toBe(
      'Check failed for [email]',
    );
    expect(maskPersonalData('Call (206) 555-0100 or +1 206.555.0101 or 2065550102')).toBe(
      'Call [phone] or [phone] or [phone]',
    );
  });

  it('leaves ordinary text and ids alone', () => {
    const text = 'Incident 71000000-0000-0000-0000-000000000001 failed at step 3 in 2026';
    expect(maskPersonalData(text)).toBe(text);
  });
});

describe('scrubEvent', () => {
  it('removes the user, cookies, headers and query strings', () => {
    const event = scrubEvent({
      user: { id: 'u1', email: 'owner@alpha.test', ip_address: '1.2.3.4' },
      request: {
        url: 'https://app.clientshield.test/customers/cu1?checkout=success#top',
        query_string: 'checkout=success',
        cookies: { a: 'b' },
        headers: { Authorization: 'Bearer secret' },
        data: { p_customer: { full_name: 'John Smith' } },
      },
    });
    expect(event.user).toBeUndefined();
    expect(event.request).toEqual({ url: 'https://app.clientshield.test/customers/cu1' });
  });

  it('masks personal data in messages and exceptions', () => {
    const event = scrubEvent({
      message: 'Saving jane@example.com failed',
      exception: { values: [{ type: 'Error', value: 'Phone (206) 555-0100 is taken' }] },
    });
    expect(event.message).toBe('Saving [email] failed');
    expect(event.exception?.values?.[0]?.value).toBe('Phone [phone] is taken');
  });

  it('strips query strings from request breadcrumbs and drops console breadcrumbs', () => {
    const event = scrubEvent({
      breadcrumbs: [
        {
          category: 'fetch',
          data: {
            url: 'https://abcd.supabase.co/rest/v1/customers?full_name=eq.John',
            method: 'GET',
          },
        },
        { category: 'console', message: 'debug john@example.com' },
        { category: 'navigation', data: { from: '/check?x=1', to: '/alerts/a1?y=2' } },
      ],
    });
    expect(event.breadcrumbs).toEqual([
      {
        category: 'fetch',
        data: { url: 'https://abcd.supabase.co/rest/v1/customers', method: 'GET' },
      },
      { category: 'navigation', data: { from: '/check', to: '/alerts/a1' } },
    ]);
  });
});

describe('monitoringOptions', () => {
  it('is off unless a DSN is configured', () => {
    expect(monitoringOptions({})).toBeNull();
    expect(monitoringOptions({ VITE_SENTRY_DSN: '  ' })).toBeNull();
  });

  it('turns on error reports only, with no personal data, tracing or replays', () => {
    const options = monitoringOptions({
      VITE_SENTRY_DSN: 'https://key@o1.ingest.us.sentry.io/2',
      VITE_RELEASE: 'abc123',
      MODE: 'production',
    });
    expect(options).toMatchObject({
      dsn: 'https://key@o1.ingest.us.sentry.io/2',
      release: 'abc123',
      environment: 'production',
      sendDefaultPii: false,
      tracesSampleRate: 0,
    });
    expect(options?.beforeSend).toBe(scrubEvent);
    expect(options?.beforeBreadcrumb).toBeTypeOf('function');
  });
});
