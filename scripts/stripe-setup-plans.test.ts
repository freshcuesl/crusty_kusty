import { describe, expect, it, vi } from 'vitest';
import {
  PLANS,
  checkSecretKey,
  formEncode,
  readEnvValue,
  setupPlans,
} from './stripe-setup-plans.mjs';

describe('plan prices', () => {
  it('match the agreed prices, with two months free on yearly', () => {
    expect(PLANS.map((p) => [p.lookupKey, p.amount])).toEqual([
      ['clientshield_pro_month', 2900],
      ['clientshield_pro_year', 29000],
      ['clientshield_team_month', 5900],
      ['clientshield_team_year', 59000],
    ]);
  });
});

describe('checkSecretKey', () => {
  it('accepts Stripe test keys', () => {
    expect(() => checkSecretKey('sk_test_abc', [])).not.toThrow();
    expect(() => checkSecretKey('rk_test_abc', [])).not.toThrow();
  });

  it('refuses live keys unless --live is given', () => {
    expect(() => checkSecretKey('sk_live_abc', [])).toThrow(/--live/);
    expect(() => checkSecretKey('sk_live_abc', ['--live'])).not.toThrow();
  });

  it('explains a missing or placeholder key', () => {
    expect(() => checkSecretKey('', [])).toThrow(/STRIPE_SECRET_KEY/);
    expect(() => checkSecretKey('sk_test_replace_me', [])).toThrow(/STRIPE_SECRET_KEY/);
    expect(() => checkSecretKey('pk_test_abc', [])).toThrow(/secret key/);
  });
});

describe('readEnvValue', () => {
  it('reads one value from a .env file', () => {
    const env = '# comment\nAPP_URL=http://localhost:5173\nSTRIPE_SECRET_KEY="sk_test_123"\n';
    expect(readEnvValue(env, 'STRIPE_SECRET_KEY')).toBe('sk_test_123');
    expect(readEnvValue(env, 'MISSING')).toBe('');
  });
});

describe('formEncode', () => {
  it('encodes nested values the way the Stripe API expects', () => {
    expect(
      formEncode({ a: 1, b: { c: 'x y' }, d: ['p', 'q'], e: [{ f: 'g' }], skip: undefined }),
    ).toBe('a=1&b%5Bc%5D=x%20y&d%5B0%5D=p&d%5B1%5D=q&e%5B0%5D%5Bf%5D=g');
  });
});

describe('setupPlans', () => {
  /** A tiny fake of the Stripe API that remembers what was created. */
  function fakeStripe(existing: { prices?: unknown[]; configs?: unknown[] } = {}) {
    const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
    let n = 0;
    const call = vi.fn(async (method: string, path: string, body?: Record<string, unknown>) => {
      calls.push({ method, path, body });
      if (method === 'GET' && path.startsWith('/v1/products/search')) return { data: [] };
      if (method === 'GET' && path.startsWith('/v1/prices')) {
        return { data: existing.prices ?? [] };
      }
      if (method === 'GET' && path.startsWith('/v1/billing_portal/configurations')) {
        return { data: existing.configs ?? [] };
      }
      return { id: `obj_${++n}` };
    });
    return { call, calls };
  }

  it('creates both products, all four prices and the billing portal settings', async () => {
    const stripe = fakeStripe();
    const log = vi.fn();
    await setupPlans(stripe.call, log);

    const created = stripe.calls.filter((c) => c.method === 'POST').map((c) => c.path);
    expect(created.filter((p) => p === '/v1/products')).toHaveLength(2);
    expect(created.filter((p) => p === '/v1/prices')).toHaveLength(4);
    expect(created).toContain('/v1/billing_portal/configurations');

    const proYear = stripe.calls.find(
      (c) => c.path === '/v1/prices' && c.body?.lookup_key === 'clientshield_pro_year',
    );
    expect(proYear?.body).toMatchObject({
      unit_amount: 29000,
      currency: 'usd',
      recurring: { interval: 'year' },
      transfer_lookup_key: true,
    });
    const portal = stripe.calls.find((c) => c.path === '/v1/billing_portal/configurations');
    expect(portal?.body).toMatchObject({ metadata: { app: 'clientshield' } });
  });

  it('can run again safely: matching prices and portal settings are reused', async () => {
    const prices = PLANS.map((p) => ({
      id: `price_${p.lookupKey}`,
      lookup_key: p.lookupKey,
      unit_amount: p.amount,
      product: 'prod_1',
      recurring: { interval: p.interval },
    }));
    const stripe = fakeStripe({
      prices,
      configs: [{ id: 'bpc_1', metadata: { app: 'clientshield' } }],
    });
    await setupPlans(stripe.call, vi.fn());
    const posts = stripe.calls.filter((c) => c.method === 'POST').map((c) => c.path);
    expect(posts.filter((p) => p === '/v1/prices')).toHaveLength(0);
    expect(posts).toContain('/v1/billing_portal/configurations/bpc_1');
  });
});
